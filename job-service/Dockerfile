FROM node:20.18.0

WORKDIR /app

# 先复制包管理文件（这一层只在依赖变化时失效）
COPY package.json yarn.lock ./

# 安装依赖（npmmirror 加速，frozen-lockfile 确保一致性）
RUN yarn config set registry https://registry.npmmirror.com && yarn install --frozen-lockfile

# 再复制源代码（源码变化不影响依赖缓存）
COPY . .

# 暴露端口
# EXPOSE 3006

# 启动应用
CMD ["npm", "start"]