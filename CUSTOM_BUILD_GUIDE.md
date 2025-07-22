# Docmost 自定义构建指南

本指南将帮助你构建一个隐藏了分享页面导航栏的 Docmost 自定义版本。

## 修改内容

### 1. 分享页面导航栏隐藏
- **文件**: `apps/client/src/features/share/components/share-shell.tsx`
- **修改**: 注释掉了 `AppShell.Header` 组件和相关的 header 配置
- **效果**: 分享页面将不再显示顶部导航栏

### 2. CSS 样式支持
- **文件**: `apps/client/src/features/share/components/share.module.css`
- **新增**: `.hideHeader` 类用于备用的隐藏方案

## 构建步骤

### 方法一：使用构建脚本（推荐）

1. 确保你在 docmost 项目根目录下：
   ```bash
   cd /root/cms/docmost/docmost
   ```

2. 运行构建脚本：
   ```bash
   ./build-docker.sh
   ```

3. 等待构建完成，镜像名称为 `docmost-custom:latest`

### 方法二：手动构建

1. 在项目根目录下运行：
   ```bash
   docker build -t docmost-custom:latest .
   ```

## 部署方式

### 方法一：使用自定义 docker-compose 文件

1. 使用提供的自定义配置文件：
   ```bash
   docker-compose -f docker-compose.custom.yml up -d
   ```

### 方法二：修改现有 docker-compose.yml

将 `docker-compose.yml` 中的：
```yaml
image: docmost/docmost:latest
```

修改为：
```yaml
image: docmost-custom:latest
```

然后运行：
```bash
docker-compose up -d
```

### 方法三：直接运行容器

```bash
# 启动数据库和 Redis
docker run -d --name docmost-db \
  -e POSTGRES_DB=docmost \
  -e POSTGRES_USER=docmost \
  -e POSTGRES_PASSWORD=STRONG_DB_PASSWORD \
  -v docmost_db:/var/lib/postgresql/data \
  postgres:16-alpine

docker run -d --name docmost-redis \
  -v docmost_redis:/data \
  redis:7.2-alpine

# 启动 Docmost
docker run -d --name docmost-custom \
  -p 3000:3000 \
  -e APP_URL='http://localhost:3000' \
  -e APP_SECRET='REPLACE_WITH_LONG_SECRET' \
  -e DATABASE_URL='postgresql://docmost:STRONG_DB_PASSWORD@docmost-db:5432/docmost?schema=public' \
  -e REDIS_URL='redis://docmost-redis:6379' \
  -v docmost_storage:/app/data/storage \
  --link docmost-db:db \
  --link docmost-redis:redis \
  docmost-custom:latest
```

## 验证部署

1. 访问 `http://localhost:3000` 确认 Docmost 正常运行
2. 创建一个页面并生成分享链接
3. 访问分享链接，确认导航栏已被隐藏

## 恢复导航栏

如果需要恢复导航栏功能，请编辑 `apps/client/src/features/share/components/share-shell.tsx` 文件：

1. 取消注释 `header={{ height: 50 }}` 行
2. 取消注释整个 `AppShell.Header` 组件
3. 重新构建镜像

## 注意事项

1. **数据安全**: 请确保修改默认密码和密钥
2. **端口配置**: 根据需要修改端口映射
3. **数据持久化**: 确保正确配置 Docker 卷以保存数据
4. **网络配置**: 如果部署在服务器上，请修改 `APP_URL` 环境变量

## 故障排除

### 构建失败
- 检查 Docker 是否正确安装
- 确保有足够的磁盘空间
- 检查网络连接是否正常

### 容器启动失败
- 检查环境变量配置
- 确认数据库和 Redis 容器正常运行
- 查看容器日志：`docker logs docmost-custom`

### 分享页面仍显示导航栏
- 确认使用的是自定义构建的镜像
- 清除浏览器缓存
- 检查修改是否正确应用

## 技术支持

如果遇到问题，请检查：
1. Docker 和 docker-compose 版本
2. 系统资源使用情况
3. 网络端口是否被占用
4. 日志文件中的错误信息