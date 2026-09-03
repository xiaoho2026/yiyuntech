#!/usr/bin/env bash
# ============================================================
# 义云官网 → 腾讯云轻量服务器 一键上传并启动
# 前提：
#   1. 服务器已按备忘完成基础设施（Docker、web_gateway、gateway、site-main 目录）
#   2. 本机已配置 SSH 免密登录（ssh ubuntu@139.155.130.188 可直达）
# 用法（在项目根目录执行）：
#   ./deploy-to-tencent.sh                 # 默认 ubuntu@139.155.130.188
#   ./deploy-to-tencent.sh root@1.2.3.4    # 自定义 SSH 目标
# 说明：只上传构建所需源码，不会覆盖服务器上已有的 .env / data / docker-compose.yml
# ============================================================
set -euo pipefail

SSH_TARGET="${1:-ubuntu@139.155.130.188}"
REMOTE_DIR="/opt/services/site-main"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> 0/4 检查本地目录"
for f in package.json package-lock.json vite.config.ts Dockerfile server.cjs .dockerignore 404.html index.html .env.example; do
  [ -f "$LOCAL_DIR/$f" ] || { echo "✗ 缺少 $f，请在项目根目录运行"; exit 1; }
done
[ -d "$LOCAL_DIR/assets" ] || { echo "✗ 缺少 assets/"; exit 1; }

echo "==> 1/4 上传源码到 $SSH_TARGET:$REMOTE_DIR"
rsync -avz -e ssh \
  "$LOCAL_DIR/package.json" "$LOCAL_DIR/package-lock.json" "$LOCAL_DIR/vite.config.ts" \
  "$LOCAL_DIR/Dockerfile" "$LOCAL_DIR/server.cjs" "$LOCAL_DIR/.dockerignore" \
  "$LOCAL_DIR/404.html" "$LOCAL_DIR/index.html" "$LOCAL_DIR/.env.example" \
  "$SSH_TARGET:$REMOTE_DIR/"
rsync -avz -e ssh -r "$LOCAL_DIR/assets" "$SSH_TARGET:$REMOTE_DIR/"

echo "==> 2/4 远程准备（检查 compose / 初始化 data / 首次 .env）"
ssh "$SSH_TARGET" "
  set -e
  [ -f $REMOTE_DIR/docker-compose.yml ] || { echo '✗ $REMOTE_DIR/docker-compose.yml 不存在，请先按备忘创建'; exit 1; }
  mkdir -p $REMOTE_DIR/data
  cd $REMOTE_DIR
  if [ -f .env ]; then
    echo '   .env 已存在，保留'
  else
    cp .env.example .env
    echo '   ✔ 已生成 .env 模板 —— 首次部署请编辑 .env 填写 SMTP_PASS'
  fi
"

echo "==> 3/4 构建并启动"
ssh "$SSH_TARGET" "cd $REMOTE_DIR && docker compose up -d --build"

echo "==> 4/4 验证"
ssh "$SSH_TARGET" "cd $REMOTE_DIR && docker compose ps && echo '--- HTTP 检查 ---' && curl -s -o /dev/null -w 'GET /            -> %{http_code}\n' http://localhost:3000/ && curl -s -o /dev/null -w 'GET /api/leads   -> %{http_code}\n' http://localhost:3000/api/leads"

echo ""
echo "✔ 完成。浏览器打开：http://139.155.130.188:3000"
echo "  首次部署别忘了：ssh $SSH_TARGET 后 nano $REMOTE_DIR/.env 填 SMTP_PASS"
