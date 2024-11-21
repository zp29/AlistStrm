# 使用官方Node.js 18镜像作为基础镜像
FROM node:18 AS build

LABEL README.md="https://raw.githubusercontent.com/zp29/AlistStrm/refs/heads/master/README.md"

# 设置工作目录
WORKDIR /app

# 定义构建时传递的参数,设置环境变量
ARG Server_Host
ENV Server_Host=$Server_Host


# 复制前端和后端的 package.json 文件并安装依赖
# 这一步在后续构建中只有在 package.json 文件变动时才会重新执行
COPY web/package*.json ./web/
COPY server/package*.json ./server/

# 安装所有依赖
RUN cd web && npm install
RUN cd server && npm install

# 安装http-server（全局安装）
RUN npm install -g http-server

# 复制源代码到容器
COPY web /app/web
COPY server /app/server

# 使用 sed 修改 .env 文件，替换占位符为 Docker Compose 中传递的环境变量
RUN sed -i "s|VITE_Server_Host=.*|VITE_Server_Host=$Server_Host|" /app/web/.env

# 构建前端应用
RUN cd web && npm run build

# 公开前端和后端的端口
EXPOSE 8080 3000 18095

# 启动前后端服务
CMD bash -c "cd /app/web/dist && http-server -p 8080 -s & cd /app/server && node app.js"