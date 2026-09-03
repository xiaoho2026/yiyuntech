#!/usr/bin/env bash
# ============================================================
# 义云科技官网 · Ubuntu 服务器首次部署脚本
# 适用：Ubuntu 20.04 / 22.04 / 24.04（x86_64 / arm64 均可）
# 用法：把项目上传到服务器后，在项目目录执行：
#         sudo bash deploy-ubuntu.sh
# 作用：安装 Docker + Compose 插件 → 开机自启 → 防火墙放行
#       80/443 → 打印后续 4 步（.env / 域名 / DNS / 启动）
# ============================================================
set -euo pipefail

# ---- 0. 权限检查 ----
if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 运行：sudo bash deploy-ubuntu.sh"
  exit 1
fi

# ---- 1. 系统检查 ----
if ! grep -qi 'ubuntu' /etc/os-release 2>/dev/null; then
  echo "本脚本仅适用于 Ubuntu，当前系统不匹配，已退出。"
  exit 1
fi
echo "✔ 系统：$(. /etc/os-release && echo "${PRETTY_NAME:-Ubuntu}")"

# ---- 2. 安装 Docker + Compose 插件 ----
if command -v docker >/dev/null 2>&1; then
  echo "✔ Docker 已存在：$(docker --version)"
else
  echo "→ 正在安装 Docker（官方脚本 + 阿里云镜像加速，国内网络更稳）..."
  curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
fi

# ---- 3. 开机自启并启动 ----
systemctl enable --now docker
echo "✔ Docker 已设为开机自启"

# ---- 4. 当前用户加入 docker 组（重登后免 sudo 使用 docker）----
if [ -n "${SUDO_USER:-}" ]; then
  usermod -aG docker "$SUDO_USER" 2>/dev/null || true
  echo "✔ 已将用户 ${SUDO_USER} 加入 docker 组（重新登录后生效）"
fi

# ---- 5. 验证版本 ----
docker --version
if docker compose version >/dev/null 2>&1; then
  docker compose version
else
  echo "⚠ 未检测到 docker compose 插件，请手动安装："
  echo "  apt-get update && apt-get install -y docker-compose-plugin"
fi

# ---- 6. 防火墙放行（若启用了 ufw）----
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q 'Status: active'; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  echo "✔ ufw 已放行 80 / 443"
else
  echo "→ 未启用 ufw；请确认云厂商「安全组」已放行 80 / 443"
fi

# ---- 7. 打印后续步骤 ----
cat <<'EOF'

==============================================================
✅ Docker 安装完成。请在【项目目录】里继续完成 4 步：

  1. 配置密钥
       cp .env.example .env && nano .env
     必填：SMTP_PASS = QQ邮箱 16 位授权码（不是登录密码）
     可选：SERVERCHAN_KEY（Server酱微信推送）

  2. 改成你的真实主域名
       nano Caddyfile
     把里面的 yiyun.example.com 全部替换成你的主域名

  3. 配 DNS（在域名服务商后台）
     主域名 + 每个子域名，各加一条 A 记录 → 本服务器公网 IP

  4. 构建并启动
       docker compose up -d --build
     验证：
       docker compose ps
       浏览器打开 https://你的主域名
==============================================================
EOF
