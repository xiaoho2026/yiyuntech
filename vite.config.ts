import { defineConfig, Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

function leadsApiPlugin(): Plugin {
  return {
    name: 'leads-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/leads' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const data = JSON.parse(body || '{}');
              const { name, contact, topic, note } = data;

              if (!name || !contact) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: '请填写姓名和联系方式' }));
                return;
              }

              const timeStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
              const leadRecord = {
                id: 'lead_' + Date.now(),
                name: String(name).slice(0, 100),
                contact: String(contact).slice(0, 100),
                topic: String(topic || 'AI 应用落地').slice(0, 100),
                note: String(note || '').slice(0, 500),
                createdAt: new Date().toISOString(),
                createdAtLocal: timeStr,
                ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown'
              };

              // 1. 本地持久化保存到 leads.json（确保任何情况下商机线索绝不丢失）
              const leadsFilePath = path.resolve(process.cwd(), 'leads.json');
              let existingLeads: any[] = [];
              try {
                if (fs.existsSync(leadsFilePath)) {
                  const fileContent = fs.readFileSync(leadsFilePath, 'utf-8');
                  existingLeads = JSON.parse(fileContent || '[]');
                }
              } catch (e) {
                existingLeads = [];
              }
              existingLeads.unshift(leadRecord);
              fs.writeFileSync(leadsFilePath, JSON.stringify(existingLeads, null, 2), 'utf-8');

              let emailSent = false;
              let wechatPushed = false;

              // 2. 邮件推送（发件至 1617762195@qq.com）
              const adminEmail = process.env.ADMIN_EMAIL || '1617762195@qq.com';
              const smtpUser = process.env.SMTP_USER || adminEmail;
              const smtpPass = process.env.SMTP_PASS;

              if (smtpPass) {
                try {
                  const nodemailer = await import('nodemailer');
                  const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST || 'smtp.qq.com',
                    port: Number(process.env.SMTP_PORT) || 465,
                    secure: true,
                    auth: {
                      user: smtpUser,
                      pass: smtpPass
                    }
                  });

                  const mailHtml = `
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Segoe UI',sans-serif;max-width:580px;margin:0 auto;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;background:#FFFFFF;">
                      <div style="background:#0F172A;padding:24px 28px;color:#FFFFFF;">
                        <h2 style="margin:0 0 6px;font-size:18px;color:#38BDF8;">🔔 义云科技官网 · 收到新客户需求咨询</h2>
                        <p style="margin:0;font-size:13px;color:#94A3B8;">请尽快联系客户进行需求对接</p>
                      </div>
                      <div style="padding:24px 28px;">
                        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1E293B;">
                          <tr style="border-bottom:1px solid #F1F5F9;">
                            <td style="padding:10px 0;width:100px;color:#64748B;font-weight:600;">客户称呼</td>
                            <td style="padding:10px 0;font-weight:700;font-size:15px;color:#0F172A;">${leadRecord.name}</td>
                          </tr>
                          <tr style="border-bottom:1px solid #F1F5F9;">
                            <td style="padding:10px 0;color:#64748B;font-weight:600;">联系方式</td>
                            <td style="padding:10px 0;font-weight:700;color:#2563EB;font-size:16px;">${leadRecord.contact}</td>
                          </tr>
                          <tr style="border-bottom:1px solid #F1F5F9;">
                            <td style="padding:10px 0;color:#64748B;font-weight:600;">意向业务</td>
                            <td style="padding:10px 0;"><span style="display:inline-block;padding:3px 10px;background:#EFF6FF;color:#1D4ED8;border-radius:6px;font-weight:600;font-size:13px;">${leadRecord.topic}</span></td>
                          </tr>
                          <tr style="border-bottom:1px solid #F1F5F9;">
                            <td style="padding:10px 0;color:#64748B;font-weight:600;">需求留言</td>
                            <td style="padding:10px 0;line-height:1.6;color:#334155;">${leadRecord.note || '<span style="color:#94A3B8;">（未填写具体需求描述）</span>'}</td>
                          </tr>
                          <tr>
                            <td style="padding:10px 0;color:#64748B;font-weight:600;">提交时间</td>
                            <td style="padding:10px 0;color:#64748B;font-size:13px;">${timeStr}</td>
                          </tr>
                        </table>
                      </div>
                      <div style="background:#F8FAFC;padding:14px 28px;font-size:12px;color:#94A3B8;border-top:1px solid #E2E8F0;">
                        提示：若您的微信开启了【QQ邮箱提醒】功能，手机将实时收到微信服务通知。
                      </div>
                    </div>
                  `;

                  await transporter.sendMail({
                    from: `"义云科技官网" <${smtpUser}>`,
                    to: adminEmail,
                    subject: `【新客咨询】${leadRecord.name} - 关注：${leadRecord.topic}`,
                    html: mailHtml
                  });
                  emailSent = true;
                } catch (emailErr) {
                  console.error('[Leads API] 邮件发送失败:', emailErr);
                }
              }

              // 3. 可选：Server酱微信推送
              const serverChanKey = process.env.SERVERCHAN_KEY;
              if (serverChanKey) {
                try {
                  const desp = `### 客户称呼：${leadRecord.name}\n\n- **联系方式**：${leadRecord.contact}\n- **意向方向**：${leadRecord.topic}\n- **需求留言**：${leadRecord.note || '无'}\n- **提交时间**：${timeStr}`;
                  await fetch(`https://sctapi.ftqq.com/${serverChanKey}.send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                      title: `【义云科技】新客户咨询：${leadRecord.name}`,
                      desp: desp
                    })
                  });
                  wechatPushed = true;
                } catch (scErr) {
                  console.error('[Leads API] Server酱推送失败:', scErr);
                }
              }

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                saved: true,
                emailSent,
                wechatPushed,
                message: '需求已成功送达技术团队，我们将于 2 小时内与您联系。'
              }));
            } catch (err: any) {
              console.error('[Leads API] 解析错误:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: '服务器内部错误' }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [leadsApiPlugin()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
  },
});

