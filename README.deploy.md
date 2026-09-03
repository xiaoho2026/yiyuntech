# 义云科技官网・生产部署指南（Docker + Caddy，支持多实例）

本方案把官网打包成一个 Docker 容器，前面用 Caddy 做反向代理（自动 HTTPS），

同一台服务器可继续追加其他实例（多技术栈），各自占用子域名，互不干扰。

## 架构一览



```
公网访客 → 主域名/子域名（HTTPS）→ Caddy（唯一对外开放 80/443）

&#x20;                                      ├─ 主域名     → yiyun-web:3000（官网，含表单接口）

&#x20;                                      ├─ 子域名 A   → app-a:8000（你的其他实例）

&#x20;                                      └─ 子域名 B   → app-b:5000（你的其他实例）
```

## 目录文件说明



| 文件                   | 作用                                                              |
| -------------------- | --------------------------------------------------------------- |
| `server.cjs`         | 官网正式服务：静态页 + `POST /api/leads`（落盘 + 邮件 + 微信推送 + 限频），CommonJS 脚本 |
| `Dockerfile`         | 官网镜像：多阶段构建（build → 精简运行）                                        |
| `docker-compose.yml` | 编排：`yiyun-web` + `caddy`，可继续追加其他实例                              |
| `Caddyfile`          | 反向代理路由：主域名给官网，子域名给其他实例                                          |
| `.env`               | 密钥配置（邮件 / 微信 / 限频），**不要提交到 git**                                |
| `data/leads.json`    | 客户线索数据（容器挂载到宿主机的 `./data`），务必备份                                 |

## 一、服务器准备（一次性）

> 服务器是 
>
> **Ubuntu**
>
>  的话，用仓库里的一键脚本最省事（含国内阿里云镜像加速）：



```
\# 在项目目录里执行（需 root）

sudo bash deploy-ubuntu.sh
```

脚本会自动完成：安装 Docker + Compose 插件 → 开机自启 → 放行防火墙 80/443 →

打印后续 4 步（配置 .env/ 改 Caddyfile 域名 / 配 DNS / 构建启动）。

如果是其他 Linux 发行版，手动安装：



```
\# 国内网络推荐加 --mirror Aliyun 参数（否则官方源常超时）

curl -fsSL https://get.docker.com | sh -s -- --mirror Aliyun

sudo systemctl enable --now docker
```

开放防火墙端口：`80`、`443`（只需这两个，其他端口不对外）。

注意：云服务器还需在 \*\* 云厂商控制台的 "安全组"\*\* 里放行 80/443，这一步在服务器内开 ufw 不生效。

## 〇、域名未备案？先这样上线

国内云厂商（腾讯云/阿里云）大陆节点会拦截**未备案域名**的 80/443 访问。
所以备案通过前，先把官网部署好、用 **IP + 端口** 临时访问验证，等备案通过再绑域名。

备案期间上线流程：

1. 先只启动官网（不起 Caddy）：
   ```bash
   docker compose up -d --build yiyun-web
   ```
2. 用仓库里的 `docker-compose.override.yml`（会自动合并，把官网 3000 端口暴露到公网）：
   无需手动改 `docker-compose.yml`。
3. 在腾讯云控制台「防火墙」放行 `3000` 端口。
4. 浏览器访问 `http://服务器公网IP:3000` 验证（页面 + 表单都要试）。
5. **备案通过后**正式上线：
   - 删除 `docker-compose.override.yml`
   - 改 `Caddyfile` 域名 → 域名商配 DNS → 控制台放行 80/443
   - `docker compose up -d --build`（全量启动，含 Caddy 自动 HTTPS）

## 二、把官网跑起来



1. 把项目目录上传到服务器（如 `scp -r . server:/opt/yiyun`，或 git clone）。

2. 进入项目目录，配置环境变量：



```
cp .env.example .env

nano .env     # 填 SMTP\_PASS（QQ邮箱授权码）、SERVERCHAN\_KEY（可选）等
```



1. 修改 `Caddyfile`：把 `yiyun.example.com` 全部替换成你的真实主域名。

2. **DNS 解析**（在域名服务商后台操作，关键一步）：

* 主域名：A 记录 → 服务器公网 IP

* 每个子域名：A 记录 → 服务器公网 IP（后续每加一个实例就加一条）

1. 启动：



```
docker compose up -d --build
```



1. 验证：

* 浏览器打开 `https://你的主域名`，应看到官网

* 填一次表单，应能在 `data/leads.json` 看到记录、并收到邮件 / 微信通知

* `curl https://你的主域名/api/leads` 用 GET 应返回 405（说明接口在）

## 三、子域名怎么用（主域名留给官网，其他实例用子域名）



* 官网固定用主域名（`你的主域名`），其他实例各占一个子域名。

* 加一个实例只需三步：

1. **DNS**：给该实例加一条子域名 A 记录 → 服务器 IP

2. **docker-compose.yml**：追加一个 service（多技术栈就换镜像，参考文件里的示例）

3. **Caddyfile**：加一条规则 `app-a.你的主域名 { reverse_proxy app-a:8000 }`

* 改完 Caddyfile 生效（无需重启官网）：



```
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```



* 实例间通过 Docker 内部网络按**服务名**互相访问，端口互不冲突；对外只有 Caddy 一个入口。

## 四、日常运维命令



```
docker compose up -d --build   # 构建并启动（首次/代码更新后）

docker compose ps              # 查看运行状态

docker compose logs -f yiyun-web   # 查看官网日志

docker compose logs -f caddy       # 查看反代/证书日志

docker compose restart yiyun-web   # 重启官网

docker compose down               # 停止（不会删数据卷）
```

## 五、数据备份（务必做）

客户线索在宿主机 `./data/` 目录。建议加一条 crontab 每日备份：



```
crontab -e

\# 每天 2 点把线索与配置打包备份

0 2 \* \* \* tar -czf /backup/yiyun-\$(date +\\%F).tar.gz -C /opt/yiyun data .env Caddyfile
```

也可同步一份到对象存储 / 网盘，双保险。

## 六、防刷

`server.js` 已内置按 IP 限频（默认每分钟 5 次 / IP，可用 `.env` 的 `RATE_LIMIT_MAX` 调整）。

若担心更高强度攻击，建议再加一层：Cloudflare 免费 CDN 挡在前面（隐藏源站 IP、自带防护）。

## 七、常见问题



* **表单提交后没收到邮件**：检查 `.env` 的 `SMTP_PASS` 是否为 QQ 邮箱 16 位授权码（不是登录密码）；QQ 邮箱需在 "设置→账户→开启 SMTP" 生成授权码。

* **HTTPS 证书没自动签发**：先确认 DNS 解析生效（`dig 你的域名`），并保证 80/443 可公网访问；Caddy 会在首次请求时自动申请。

* **改了页面不生效**：重新构建并重启官网：`docker compose up -d --build yiyun-web`。

* **本地调试**（不开 Docker）：`npm install && npm run build && npm start`，然后访问 `http://localhost:3000`。