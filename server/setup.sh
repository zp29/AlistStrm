#!/bin/bash

# 安装依赖
echo "正在安装项目依赖..."
npm install

# 编译 TypeScript 代码
echo "正在编译 TypeScript 代码..."
npm run build

# 创建 public 目录
mkdir -p public

# 复制 HTML 文件到 public 目录
if [ -f "index.html" ]; then
  echo "复制 index.html 到 public 目录..."
  cp index.html public/
fi

echo "设置完成！你可以通过以下命令启动项目："
echo "npm start"
echo "或者在开发模式下启动:"
echo "npm run dev"
