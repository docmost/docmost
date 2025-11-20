# GitHub 代码管理工作流指南

> 本指南帮助您使用 GitHub 管理 Docmost 自定义版本，同时保持与上游仓库的同步能力。

## 🎯 目标

1. ✅ Fork Docmost 到您的 GitHub 账户
2. ✅ 管理自定义代码（custom/ 目录）
3. ✅ 定期同步上游更新
4. ✅ 保持清晰的版本历史

---

## 📋 前置准备

### 1. 确认 Git 配置

```bash
# 检查 Git 配置
git config --global user.name
git config --global user.email

# 如果未配置，设置您的信息
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 2. 确认 GitHub 账户

- 确保您有 GitHub 账户
- 配置 SSH 密钥或使用 HTTPS（推荐 SSH）

---

## 🚀 初始设置（首次执行）

### 第一步：在 GitHub 上 Fork Docmost

1. **访问 Docmost 仓库**
   - 打开浏览器访问：https://github.com/docmost/docmost

2. **点击 Fork 按钮**
   - 点击页面右上角的 "Fork" 按钮
   - 选择您的 GitHub 账户
   - 等待 Fork 完成

3. **记录您的 Fork 地址**
   ```
   https://github.com/YOUR_USERNAME/docmost
   ```

### 第二步：配置本地仓库

```bash
# 进入项目目录
cd /Users/zhoukai/Documents/solo/docmost

# 检查当前 remote
git remote -v

# 如果已经有 origin，先删除
git remote remove origin

# 添加您的 Fork 作为 origin
git remote add origin git@github.com:YOUR_USERNAME/docmost.git
# 或使用 HTTPS: git remote add origin https://github.com/YOUR_USERNAME/docmost.git

# 添加上游仓库
git remote add upstream https://github.com/docmost/docmost.git

# 验证配置
git remote -v
# 应该看到：
# origin    git@github.com:YOUR_USERNAME/docmost.git (fetch)
# origin    git@github.com:YOUR_USERNAME/docmost.git (push)
# upstream  https://github.com/docmost/docmost.git (fetch)
# upstream  https://github.com/docmost/docmost.git (push)
```

### 第三步：创建自定义分支

```bash
# 创建并切换到自定义主分支
git checkout -b custom-main

# 推送到您的 GitHub
git push -u origin custom-main

# 设置默认分支（可选）
# 在 GitHub 网页上：Settings -> Branches -> Default branch -> custom-main
```

---

## 📁 分支策略

### 推荐的分支结构

```
origin (您的 Fork)
├── main              # 保持与上游同步（不做修改）
├── custom-main       # 自定义主分支（包含所有自定义代码）
├── feature/oidc      # 功能分支：OIDC SSO
├── feature/blocks    # 功能分支：Block 系统
└── feature/sync      # 功能分支：同步块

upstream (Docmost 官方)
└── main              # 上游主分支
```

### 分支说明

| 分支 | 用途 | 是否修改 |
|------|------|---------|
| `main` | 镜像上游，用于同步 | ❌ 不修改 |
| `custom-main` | 自定义主分支 | ✅ 包含所有自定义 |
| `feature/*` | 功能开发分支 | ✅ 开发新功能 |

---

## 🔄 日常工作流

### 开发新功能

```bash
# 1. 从 custom-main 创建功能分支
git checkout custom-main
git pull origin custom-main
git checkout -b feature/oidc-sso

# 2. 开发功能（在 custom/ 目录下）
# 编写代码...

# 3. 提交更改
git add apps/server/src/custom/oidc/
git commit -m "feat(oidc): implement OIDC authentication strategy"

# 4. 推送到 GitHub
git push -u origin feature/oidc-sso

# 5. 在 GitHub 上创建 Pull Request
# feature/oidc-sso -> custom-main

# 6. 合并后删除功能分支
git checkout custom-main
git pull origin custom-main
git branch -d feature/oidc-sso
git push origin --delete feature/oidc-sso
```

### 提交规范（推荐使用 Conventional Commits）

```bash
# 功能
git commit -m "feat(oidc): add OIDC login support"

# 修复
git commit -m "fix(block): resolve sync block update issue"

# 文档
git commit -m "docs: update setup guide"

# 样式
git commit -m "style: format code with prettier"

# 重构
git commit -m "refactor(block): extract block service logic"

# 测试
git commit -m "test(oidc): add unit tests for OIDC service"

# 构建
git commit -m "chore: update dependencies"
```

---

## 🔄 同步上游更新（每半年）

### 方法 1：通过 main 分支同步（推荐）

```bash
# 1. 切换到 main 分支
git checkout main

# 2. 拉取上游最新代码
git fetch upstream
git merge upstream/main

# 3. 推送到您的 GitHub
git push origin main

# 4. 切换到 custom-main
git checkout custom-main

# 5. 合并 main 到 custom-main
git merge main

# 6. 解决冲突（如果有）
# 编辑冲突文件...
git add .
git commit -m "chore: merge upstream updates from v0.24.0"

# 7. 推送更新
git push origin custom-main

# 8. 测试
pnpm install
pnpm dev
```

### 方法 2：直接合并上游（快速）

```bash
# 1. 在 custom-main 分支
git checkout custom-main

# 2. 拉取上游
git fetch upstream

# 3. 查看变更
git log upstream/main --oneline --since="6 months ago"

# 4. 合并上游
git merge upstream/main

# 5. 解决冲突
# 编辑冲突文件...
git add .
git commit -m "chore: merge upstream updates"

# 6. 推送
git push origin custom-main
```

### 冲突解决

**常见冲突文件**：
- `apps/server/src/app.module.ts`
- `apps/server/src/database/database.module.ts`

**解决步骤**：
```bash
# 1. 查看冲突文件
git status

# 2. 编辑冲突文件
# 查找 <<<<<<< HEAD 标记
# 保留需要的代码，删除冲突标记

# 3. 测试代码
pnpm dev

# 4. 标记为已解决
git add apps/server/src/app.module.ts
git commit -m "chore: resolve merge conflicts in app.module.ts"

# 5. 推送
git push origin custom-main
```

---

## 🏷️ 版本管理

### 创建版本标签

```bash
# 1. 确保在 custom-main 分支
git checkout custom-main

# 2. 创建标签
git tag -a v1.0.0 -m "Release v1.0.0: Initial custom version with OIDC support"

# 3. 推送标签到 GitHub
git push origin v1.0.0

# 4. 推送所有标签
git push origin --tags
```

### 版本命名规范

```
v<major>.<minor>.<patch>-custom

示例：
v1.0.0-custom  # 基于 Docmost v0.23.2 的第一个自定义版本
v1.1.0-custom  # 添加新功能
v1.1.1-custom  # 修复 bug
```

### 在 GitHub 上创建 Release

1. 访问您的仓库：`https://github.com/YOUR_USERNAME/docmost`
2. 点击 "Releases" -> "Create a new release"
3. 选择标签：`v1.0.0-custom`
4. 填写发布说明：
   ```markdown
   ## v1.0.0-custom
   
   基于 Docmost v0.23.2
   
   ### 新增功能
   - ✅ OIDC SSO 支持
   - ✅ 插件化架构
   
   ### 技术变更
   - 添加 custom/ 目录结构
   - 修改 app.module.ts 支持自定义模块加载
   ```

---

## 📊 GitHub 项目管理（可选）

### 使用 GitHub Projects

1. **创建项目看板**
   - 访问：`https://github.com/YOUR_USERNAME/docmost/projects`
   - 点击 "New project"
   - 选择 "Board" 模板

2. **创建列**
   - 📋 Backlog（待办）
   - 🚧 In Progress（进行中）
   - 👀 Review（审查中）
   - ✅ Done（完成）

3. **创建 Issues**
   ```markdown
   Title: 实现 OIDC SSO 功能
   
   ## 描述
   实现 OIDC 单点登录功能
   
   ## 任务清单
   - [ ] 创建 OIDC strategy
   - [ ] 实现 OIDC service
   - [ ] 添加前端登录按钮
   - [ ] 编写测试
   
   ## 标签
   - enhancement
   - custom-feature
   ```

### 使用 Labels（标签）

创建自定义标签：
- 🔵 `custom-feature` - 自定义功能
- 🟢 `upstream-sync` - 上游同步相关
- 🟡 `documentation` - 文档
- 🔴 `bug` - Bug 修复
- 🟣 `enhancement` - 功能增强

---

## 🔒 .gitignore 配置

确保 `.gitignore` 包含以下内容：

```bash
# 查看当前 .gitignore
cat .gitignore

# 如果需要添加自定义忽略规则
cat >> .gitignore << 'EOF'

# 自定义开发环境
.env.local
.env.development.local

# 自定义构建产物
/custom-dist/

# IDE 配置
.vscode/
.idea/

# 临时文件
*.tmp
*.log
EOF
```

---

## 📝 提交前检查清单

每次提交前确认：

```bash
# 1. 检查修改的文件
git status

# 2. 查看具体改动
git diff

# 3. 确保只提交 custom/ 目录的更改（除非必要）
git add apps/server/src/custom/
git add apps/client/src/custom/

# 4. 避免提交敏感信息
# 检查是否包含密码、API key 等

# 5. 运行测试
pnpm test

# 6. 格式化代码
pnpm format

# 7. 提交
git commit -m "feat(oidc): implement OIDC authentication"

# 8. 推送
git push origin feature/oidc-sso
```

---

## 🛡️ 保护分支设置（推荐）

在 GitHub 上设置分支保护：

1. 访问：`Settings -> Branches -> Add rule`
2. 分支名称模式：`custom-main`
3. 启用以下规则：
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators

---

## 🔍 常用 Git 命令速查

```bash
# 查看状态
git status

# 查看提交历史
git log --oneline --graph --all

# 查看某个文件的修改历史
git log --follow -- apps/server/src/custom/custom.module.ts

# 查看远程分支
git branch -r

# 查看所有分支
git branch -a

# 删除本地分支
git branch -d feature/old-feature

# 删除远程分支
git push origin --delete feature/old-feature

# 撤销未提交的更改
git checkout -- filename

# 撤销最后一次提交（保留更改）
git reset --soft HEAD~1

# 查看某次提交的详细信息
git show commit-hash

# 比较两个分支
git diff custom-main..feature/oidc-sso

# 暂存当前工作
git stash

# 恢复暂存的工作
git stash pop

# 查看暂存列表
git stash list
```

---

## 🚨 紧急情况处理

### 误提交了敏感信息

```bash
# 1. 从历史中删除文件
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/sensitive/file" \
  --prune-empty --tag-name-filter cat -- --all

# 2. 强制推送（危险操作！）
git push origin --force --all

# 3. 通知团队成员重新克隆仓库
```

### 需要回滚到之前的版本

```bash
# 1. 查找要回滚到的提交
git log --oneline

# 2. 创建新分支保存当前状态（安全起见）
git checkout -b backup-before-rollback

# 3. 回滚到指定提交
git checkout custom-main
git reset --hard commit-hash

# 4. 强制推送（确认无误后）
git push origin custom-main --force
```

---

## 📚 学习资源

- [Git 官方文档](https://git-scm.com/doc)
- [GitHub 文档](https://docs.github.com)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git 分支管理策略](https://nvie.com/posts/a-successful-git-branching-model/)

---

## ✅ 快速开始检查清单

- [ ] 在 GitHub 上 Fork Docmost 仓库
- [ ] 配置本地 remote（origin 和 upstream）
- [ ] 创建 custom-main 分支
- [ ] 推送到 GitHub
- [ ] 设置分支保护规则（可选）
- [ ] 创建第一个功能分支
- [ ] 提交第一个自定义代码
- [ ] 创建 Pull Request
- [ ] 合并到 custom-main

---

**准备好开始了吗？执行下一节的命令开始设置！** 🚀
