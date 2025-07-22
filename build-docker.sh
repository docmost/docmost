#!/bin/bash

# Docmost Docker 构建脚本
# 用于构建隐藏导航栏的自定义 Docmost 镜像

set -e

# 配置变量
IMAGE_NAME="docmost-custom"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"

echo "🚀 开始构建 Docmost 自定义镜像..."
echo "镜像名称: ${FULL_IMAGE_NAME}"
echo "构建时间: $(date)"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装或不在 PATH 中"
    exit 1
fi

# 检查是否在正确的目录
if [ ! -f "Dockerfile" ]; then
    echo "❌ 错误: 未找到 Dockerfile，请确保在 docmost 项目根目录下运行此脚本"
    exit 1
fi

# 构建 Docker 镜像
echo "📦 正在构建 Docker 镜像..."
docker build -t "${FULL_IMAGE_NAME}" .

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Docker 镜像构建成功!"
    echo "镜像名称: ${FULL_IMAGE_NAME}"
    echo ""
    echo "🔧 使用方法:"
    echo "1. 直接运行:"
    echo "   docker run -d -p 3000:3000 --name docmost-custom ${FULL_IMAGE_NAME}"
    echo ""
    echo "2. 使用 docker-compose (推荐):"
    echo "   修改 docker-compose.yml 中的 image 字段为: ${FULL_IMAGE_NAME}"
    echo "   然后运行: docker-compose up -d"
    echo ""
    echo "📝 注意事项:"
    echo "- 分享页面的导航栏已被隐藏"
    echo "- 如需恢复导航栏，请编辑 apps/client/src/features/share/components/share-shell.tsx"
    echo "- 数据将保存在 Docker 卷中，请确保正确配置数据库和 Redis"
else
    echo ""
    echo "❌ Docker 镜像构建失败!"
    exit 1
fi