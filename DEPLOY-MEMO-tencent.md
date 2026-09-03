# 腾讯云轻量服务器 · 部署备忘（2026-09 实际状态）

> 本文记录服务器上已完成的配置与当前运行状态，作为后续维护与备案后切换的依据。
> 架构为"统一网关 + 业务分离"：网关 Caddy 统一入口，每个业务独立目录与 compose，共用 `web_gateway` 网络。

## 一、基础设施现状（已完成）

| 项 | 值 |
|---|---|
| 服务器 | 腾讯云轻量应用服务器，公网 IP `139.155.130.188`，Ubuntu |
| 控制台防火墙 | 已放行 22 / 80 / 443 / 3000 |
| Docker 引擎 | Docker 29.7.2（腾讯云官方源，已配内网镜像加速 `mirror.ccs.tencentyun.com`） |
| Compose 插件 | v5.5.0 |
| 冲突进程 | 原生 Nginx 已停用并禁用自启（释放 80 端口） |
| Docker 网络 | `web_gateway`（bridge，external） |
| 目录 | `/opt/services/gateway`（网关）、`/opt/services/site-main`（官网），所有者 ubuntu:ubuntu |
| 运行中容器 | `caddy_gateway`（Up，监听 80/443，当前 Caddyfile 为占位 `:80 { respond "Gateway Ready" }`） |

## 二、当前待办（官网载入）

`/opt/services/site-main` 已就绪，等源码载入后启动。本地一键脚本：

```bash
# 在本机项目根目录执行（需已配 SSH 免密）
./deploy-to-tencent.sh          # 默认 ubuntu@139.155.130.188
```

脚本自动：上传构建源码 → 初始化 `data/` → 首次生成 `.env` 模板 → `docker compose up -d --build` → HTTP 验证。
首次部署后在服务器上补填 `.env` 的 `SMTP_PASS`（QQ 邮箱 16 位授权码）。

备案期间访问：`http://139.155.130.188:3000`（网关占位仍返回 Gateway Ready，官网走 3000 端口联调）。

## 三、备案通过后的正式切换

1. **改网关路由** `/opt/services/gateway/Caddyfile`：

   ```caddyfile
   你的主域名 {
       encode gzip
       reverse_proxy site-main:3000
   }
   # 其他子域名实例按同样方式追加，如：
   # app-a.你的主域名 { reverse_proxy app-a:8000 }
   ```

2. **重载 Caddy**（无需重启业务）：

   ```bash
   docker compose -f /opt/services/gateway/docker-compose.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
   ```

3. **DNS 解析**：主域名 + 各子域名 A 记录 → `139.155.130.188`。
4. **确认端口**：80/443 已放行；备案期间 `site-main` 的 3000 端口映射届时可移除（可选）。
5. 访问 `https://你的主域名` 验证（Caddy 自动签 HTTPS 证书）。

## 四、日常运维

```bash
# 官网容器（在 /opt/services/site-main）
docker compose -f /opt/services/site-main/docker-compose.yml logs -f
docker compose -f /opt/services/site-main/docker-compose.yml restart

# 网关
docker compose -f /opt/services/gateway/docker-compose.yml logs -f caddy

# 备份：客户线索在 /opt/services/site-main/data/，建议 crontab 每日打包
```

## 五、备注

- 官网 `server.cjs` 的线索落盘路径为 `/app/data/leads.json`（容器内），挂载到宿主机 `./data`。
- 防刷：`server.cjs` 内置按 IP 限频（默认 5 次/分钟/IP），`.env` 里 `RATE_LIMIT_MAX` 可调。
- 正式对外后建议在腾讯云控制台给网站域名开启 CDN / WAF 或前置防护（隐藏源站）。
