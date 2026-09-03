#!/usr/bin/env node
/**
 * 义云科技官网 · 生产服务
 *
 * 功能：
 *  1. 托管 dist/ 静态站点（首页、资源、404）
 *  2. POST /api/leads 接收官网"方案咨询"表单：
 *     - 写入 leads.json（数据卷持久化）
 *     - 通过 SMTP 推送邮件到管理员邮箱（推荐 QQ 邮箱，微信可秒级收到【QQ邮箱提醒】）
 *     - 可选 Server酱推送微信
 *  3. 基础防刷：按 IP 限频，防止公开接口被机器人灌数据
 *
 * 说明：新版本的 vite.config.ts 里 /api/leads 只在 `npm run dev` 开发模式生效，
 * 正式部署请用本服务（Docker / PM2 均可）。
 *
 * 环境变量：
 *  PORT                监听端口，默认 3000
 *  LEADS_FILE          leads.json 路径，默认 <项目>/data/leads.json
 *  ADMIN_EMAIL         管理员接收邮箱，默认 1617762195@qq.com
 *  SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS   SMTP 邮件配置（不配 SMTP_PASS 则不发送邮件）
 *  SERVERCHAN_KEY      Server酱微信推送 Key（可选）
 *  RATE_LIMIT_MAX      每分钟每 IP 最大提交次数，默认 5
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

// ---------- 配置 ----------
const PORT = Number(process.env.PORT || 3000);
const DIST_DIR = path.resolve(__dirname, 'dist');
const LEADS_FILE = path.resolve(process.env.LEADS_FILE || path.join(__dirname, 'data', 'leads.json'));
const MAX_BODY = 16 * 1024; // 请求体上限 16KB，防止大包攻击

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '1617762195@qq.com';
const SMTP_USER = process.env.SMTP_USER || ADMIN_EMAIL;
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.qq.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SERVERCHAN_KEY = process.env.SERVERCHAN_KEY || '';

// 防刷：滑动窗口限频（内存版，重启清零；足够挡住普通爬虫）
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 5);
const ipHits = new Map(); // ip -> number[] 时间戳

// ---------- 工具 ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function getClientIp(req) {
  return (
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

// 限频：返回 true 表示放行，false 表示超限
function rateLimitOk(ip) {
  const now = Date.now();
  const arr = (ipHits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_LIMIT_MAX) {
    ipHits.set(ip, arr);
    return false;
  }
  arr.push(now);
  ipHits.set(ip, arr);
  return true;
}

// 写 leads.json：Promise 串行化，避免并发写覆盖
let writeChain = Promise.resolve();
function appendLead(record) {
  writeChain = writeChain.then(async () => {
    let list = [];
    try {
      if (fs.existsSync(LEADS_FILE)) {
        const raw = fs.readFileSync(LEADS_FILE, 'utf-8');
        const parsed = JSON.parse(raw || '[]');
        if (Array.isArray(parsed)) list = parsed;
      }
    } catch (e) {
      list = [];
    }
    list.unshift(record);
    fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true });
    // 先写临时文件再改名，避免中途断电损坏
    const tmp = LEADS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf-8');
    fs.renameSync(tmp, LEADS_FILE);
  });
  return writeChain;
}

// 发送邮件（nodemailer）
async function sendEmail(record) {
  if (!SMTP_PASS) return false;
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    const html = `
      <div style="font-family:-apple-system,'PingFang SC',sans-serif;max-width:580px;margin:0 auto;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;background:#FFFFFF;">
        <div style="background:#0F172A;padding:24px 28px;color:#FFFFFF;">
          <h2 style="margin:0 0 6px;font-size:18px;color:#38BDF8;">🔔 义云科技官网 · 收到新客户需求咨询</h2>
          <p style="margin:0;font-size:13px;color:#94A3B8;">请尽快联系客户进行需求对接</p>
        </div>
        <div style="padding:24px 28px;font-size:14px;color:#1E293B;">
          <p style="margin:6px 0;"><strong>客户称呼：</strong>${record.name}</p>
          <p style="margin:6px 0;"><strong>联系方式：</strong>${record.contact}</p>
          <p style="margin:6px 0;"><strong>意向业务：</strong>${record.topic}</p>
          <p style="margin:6px 0;"><strong>需求留言：</strong>${record.note || '（未填写）'}</p>
          <p style="margin:6px 0;color:#64748B;font-size:13px;">提交时间：${record.createdAtLocal}</p>
        </div>
        <div style="background:#F8FAFC;padding:14px 28px;font-size:12px;color:#94A3B8;border-top:1px solid #E2E8F0;">
          提示：若您的微信开启了【QQ邮箱提醒】功能，手机将实时收到微信服务通知。
        </div>
      </div>`;
    await transporter.sendMail({
      from: `"义云科技官网" <${SMTP_USER}>`,
      to: ADMIN_EMAIL,
      subject: `【新客咨询】${record.name} - 关注：${record.topic}`,
      html,
    });
    return true;
  } catch (err) {
    log('邮件发送失败: ' + err.message);
    return false;
  }
}

// Server酱微信推送（可选）
async function pushWechat(record) {
  if (!SERVERCHAN_KEY) return false;
  try {
    const desp =
      `### 客户称呼：${record.name}\n\n` +
      `- **联系方式**：${record.contact}\n` +
      `- **意向方向**：${record.topic}\n` +
      `- **需求留言**：${record.note || '无'}\n` +
      `- **提交时间**：${record.createdAtLocal}`;
    const resp = await fetch(`https://sctapi.ftqq.com/${SERVERCHAN_KEY}.send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ title: `【义云科技】新客户咨询：${record.name}`, desp }),
    });
    return resp.ok;
  } catch (err) {
    log('Server酱推送失败: ' + err.message);
    return false;
  }
}

// ---------- 静态文件服务 ----------
function serveStatic(req, res, pathname) {
  // 防止路径穿越
  let filePath;
  try {
    filePath = path.normalize(path.join(DIST_DIR, pathname));
    if (!filePath.startsWith(DIST_DIR)) throw new Error('bad path');
  } catch (e) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    // 单页站：无扩展名的路由都回退首页；否则 404 页
    if (!path.extname(pathname)) {
      filePath = path.join(DIST_DIR, 'index.html');
    } else {
      filePath = path.join(DIST_DIR, '404.html');
    }
  }
  // 兜底：404 页也不存在时返回简单文本，避免服务崩溃
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><h1>404 Not Found</h1><p>页面不存在</p>');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
  });
  fs.createReadStream(filePath).pipe(res);
}

// ---------- 请求处理 ----------
function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  // API：提交线索
  if (pathname === '/api/leads' && req.method === 'POST') {
    return handleLeads(req, res);
  }
  if (pathname === '/api/leads') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: '仅支持 POST' }));
    return;
  }

  // 健康检查（方便 Caddy / 监控探活）
  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // 静态资源（GET/HEAD）
  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res, pathname);
  }

  res.writeHead(405).end('Method Not Allowed');
}

function handleLeads(req, res) {
  const ip = getClientIp(req);
  if (!rateLimitOk(ip)) {
    log(`限频拦截: ${ip}`);
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: '提交过于频繁，请稍后再试' }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY) {
      req.destroy();
    }
  });
  req.on('end', async () => {
    try {
      const data = JSON.parse(body || '{}');
      const name = String(data.name || '').trim().slice(0, 100);
      const contact = String(data.contact || '').trim().slice(0, 100);
      if (!name || !contact) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '请填写姓名和联系方式' }));
        return;
      }
      const record = {
        id: 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name,
        contact,
        topic: String(data.topic || 'AI 应用落地').slice(0, 100),
        note: String(data.note || '').slice(0, 500),
        createdAt: new Date().toISOString(),
        createdAtLocal: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        ip,
        userAgent: (req.headers['user-agent'] || 'unknown').slice(0, 200),
      };

      await appendLead(record); // 先落盘，确保线索不丢
      log(`收到线索: ${record.name} / ${contact} / ${record.topic}`);

      const emailSent = await sendEmail(record);
      const wechatPushed = await pushWechat(record);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        saved: true,
        emailSent,
        wechatPushed,
        message: '需求已成功送达技术团队，我们将于 2 小时内与您联系。',
      }));
    } catch (err) {
      log('解析失败: ' + err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: '服务器内部错误' }));
    }
  });
  req.on('error', () => {});
}

// ---------- 启动 ----------
const server = http.createServer(handleRequest);
server.listen(PORT, '0.0.0.0', () => {
  log(`义云官网服务已启动: http://0.0.0.0:${PORT}  数据文件: ${LEADS_FILE}`);
});
