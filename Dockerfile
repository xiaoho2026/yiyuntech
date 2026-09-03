# ---------- 构建阶段：安装依赖并产出 dist ----------
FROM node:22-alpine AS build
WORKDIR /app

# 先拷贝依赖清单，利用层缓存加速
COPY package.json package-lock.json ./
RUN npm ci

# 拷贝源码并构建
COPY . .
RUN npm run build

# ---------- 运行阶段：只保留运行时所需 ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# 运行时依赖（nodemailer 等）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 只拷贝构建产物与服务脚本
# 说明：server.cjs 使用 CommonJS，避免与 package.json 的 "type":"module" 冲突
COPY --from=build /app/dist ./dist
COPY 404.html ./dist/404.html
COPY server.cjs ./

ENV PORT=3000
EXPOSE 3000

# 数据目录（由 docker-compose 挂载为数据卷）
RUN mkdir -p /app/data

CMD ["node", "server.cjs"]
