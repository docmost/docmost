#!/bin/bash

# Docmost 自定义版本 Git 快速设置脚本
# 使用方法: ./QUICK_GIT_SETUP.sh YOUR_GITHUB_USERNAME

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查参数
if [ -z "$1" ]; then
    echo -e "${RED}错误: 请提供您的 GitHub 用户名${NC}"
    echo "使用方法: ./QUICK_GIT_SETUP.sh YOUR_GITHUB_USERNAME"
    exit 1
fi

GITHUB_USERNAME=$1
REPO_NAME="docmost"

echo -e "${GREEN}=== Docmost 自定义版本 Git 设置 ===${NC}"
echo ""

# 1. 检查 Git 配置
echo -e "${YELLOW}[1/7] 检查 Git 配置...${NC}"
if ! git config user.name > /dev/null 2>&1; then
    echo -e "${RED}请先配置 Git 用户名:${NC}"
    echo "git config --global user.name \"Your Name\""
    exit 1
fi

if ! git config user.email > /dev/null 2>&1; then
    echo -e "${RED}请先配置 Git 邮箱:${NC}"
    echo "git config --global user.email \"your.email@example.com\""
    exit 1
fi

echo -e "${GREEN}✓ Git 配置正常${NC}"
echo "  用户名: $(git config user.name)"
echo "  邮箱: $(git config user.email)"
echo ""

# 2. 检查是否在正确的目录
echo -e "${YELLOW}[2/7] 检查当前目录...${NC}"
if [ ! -f "package.json" ] || ! grep -q "docmost" package.json; then
    echo -e "${RED}错误: 请在 Docmost 项目根目录下运行此脚本${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 当前目录正确${NC}"
echo ""

# 3. 备份现有 remote 配置
echo -e "${YELLOW}[3/7] 备份现有 remote 配置...${NC}"
if git remote get-url origin > /dev/null 2>&1; then
    ORIGINAL_ORIGIN=$(git remote get-url origin)
    echo "  原 origin: $ORIGINAL_ORIGIN"
    git remote remove origin
    echo -e "${GREEN}✓ 已移除原 origin${NC}"
else
    echo "  未发现现有 origin"
fi
echo ""

# 4. 配置新的 remote
echo -e "${YELLOW}[4/7] 配置 remote...${NC}"

# 检测是否使用 SSH
read -p "使用 SSH 连接 GitHub? (推荐) [Y/n]: " use_ssh
use_ssh=${use_ssh:-Y}

if [[ $use_ssh =~ ^[Yy]$ ]]; then
    ORIGIN_URL="git@github.com:${GITHUB_USERNAME}/${REPO_NAME}.git"
    echo "  使用 SSH: $ORIGIN_URL"
else
    ORIGIN_URL="https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
    echo "  使用 HTTPS: $ORIGIN_URL"
fi

git remote add origin "$ORIGIN_URL"
git remote add upstream "https://github.com/docmost/docmost.git"

echo -e "${GREEN}✓ Remote 配置完成${NC}"
git remote -v
echo ""

# 5. 创建 custom-main 分支
echo -e "${YELLOW}[5/7] 创建 custom-main 分支...${NC}"

# 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
echo "  当前分支: $CURRENT_BRANCH"

# 如果已经在 custom-main 分支，跳过
if [ "$CURRENT_BRANCH" = "custom-main" ]; then
    echo -e "${GREEN}✓ 已在 custom-main 分支${NC}"
else
    # 检查是否已存在 custom-main 分支
    if git show-ref --verify --quiet refs/heads/custom-main; then
        echo "  custom-main 分支已存在，切换到该分支"
        git checkout custom-main
    else
        echo "  创建新的 custom-main 分支"
        git checkout -b custom-main
    fi
    echo -e "${GREEN}✓ 切换到 custom-main 分支${NC}"
fi
echo ""

# 6. 创建自定义目录结构
echo -e "${YELLOW}[6/7] 创建自定义目录结构...${NC}"

mkdir -p apps/server/src/custom/{oidc,block,migrations}
mkdir -p apps/client/src/custom/{extensions,components}
mkdir -p packages/custom-extensions/src

echo -e "${GREEN}✓ 目录结构创建完成${NC}"
echo ""

# 7. 创建初始文件
echo -e "${YELLOW}[7/7] 创建初始文件...${NC}"

# 创建 custom.module.ts
if [ ! -f "apps/server/src/custom/custom.module.ts" ]; then
    cat > apps/server/src/custom/custom.module.ts << 'EOF'
import { Module } from '@nestjs/common';

@Module({
  imports: [
    // 未来在这里添加自定义模块
    // OidcModule,
    // BlockModule,
  ],
})
export class CustomModule {}
EOF
    echo "  ✓ 创建 custom.module.ts"
fi

# 创建 .gitkeep 文件
touch apps/server/src/custom/oidc/.gitkeep
touch apps/server/src/custom/block/.gitkeep
touch apps/server/src/custom/migrations/.gitkeep
touch apps/client/src/custom/extensions/.gitkeep
touch apps/client/src/custom/components/.gitkeep
touch packages/custom-extensions/src/.gitkeep

echo -e "${GREEN}✓ 初始文件创建完成${NC}"
echo ""

# 提交初始设置
echo -e "${YELLOW}提交初始设置...${NC}"
git add apps/server/src/custom/
git add apps/client/src/custom/
git add packages/custom-extensions/
git add CUSTOM_SETUP_GUIDE.md CUSTOM_CHANGES.md GIT_WORKFLOW_GUIDE.md 2>/dev/null || true

if git diff --cached --quiet; then
    echo "  没有需要提交的更改"
else
    git commit -m "chore: initialize custom plugin architecture

- Add custom/ directory structure
- Add custom.module.ts entry point
- Add setup and workflow documentation"
    echo -e "${GREEN}✓ 初始提交完成${NC}"
fi
echo ""

# 推送到 GitHub
echo -e "${YELLOW}准备推送到 GitHub...${NC}"
echo -e "${RED}注意: 在推送之前，请确保您已经在 GitHub 上 Fork 了 Docmost 仓库！${NC}"
echo ""
echo "Fork 地址应该是: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
echo ""
read -p "是否现在推送到 GitHub? [y/N]: " push_now
push_now=${push_now:-N}

if [[ $push_now =~ ^[Yy]$ ]]; then
    echo "推送到 origin custom-main..."
    if git push -u origin custom-main; then
        echo -e "${GREEN}✓ 推送成功！${NC}"
    else
        echo -e "${RED}✗ 推送失败${NC}"
        echo "请检查："
        echo "1. 是否已在 GitHub 上 Fork 了 Docmost 仓库"
        echo "2. 是否有正确的访问权限"
        echo "3. SSH 密钥是否配置正确（如果使用 SSH）"
        echo ""
        echo "稍后可以手动推送："
        echo "  git push -u origin custom-main"
    fi
else
    echo "跳过推送。稍后可以手动推送："
    echo "  git push -u origin custom-main"
fi
echo ""

# 完成
echo -e "${GREEN}=== 设置完成！ ===${NC}"
echo ""
echo "下一步："
echo "1. 如果还未推送，请先在 GitHub 上 Fork Docmost 仓库"
echo "   访问: https://github.com/docmost/docmost"
echo ""
echo "2. 推送代码到您的 Fork:"
echo "   git push -u origin custom-main"
echo ""
echo "3. 开始开发第一个功能:"
echo "   git checkout -b feature/your-feature-name"
echo ""
echo "4. 查看完整工作流指南:"
echo "   cat GIT_WORKFLOW_GUIDE.md"
echo ""
echo -e "${GREEN}祝开发顺利！🚀${NC}"
