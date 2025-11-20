# Docmost 自定义插件快速启动指南

> 本指南帮助您快速设置插件化架构，实现自定义功能的同时保持与上游 Docmost 的同步能力。

## 🚀 快速开始（5 分钟）

### 第一步：创建自定义模块目录结构

```bash
# 在 Docmost 项目根目录执行
cd /Users/zhoukai/Documents/solo/docmost

# 创建后端自定义目录
mkdir -p apps/server/src/custom/{oidc,block,migrations}

# 创建前端自定义目录
mkdir -p apps/client/src/custom/{extensions,components}

# 创建自定义扩展包
mkdir -p packages/custom-extensions/src
```

### 第二步：创建自定义模块入口

**创建文件**: `apps/server/src/custom/custom.module.ts`

```typescript
import { Module } from '@nestjs/common';

@Module({
  imports: [
    // 未来在这里添加自定义模块
    // OidcModule,
    // BlockModule,
  ],
})
export class CustomModule {}
```

### 第三步：修改 app.module.ts（唯一需要修改的核心文件）

**编辑文件**: `apps/server/src/app.module.ts`

在文件顶部添加导入：
```typescript
import { CustomModule } from './custom/custom.module';
```

在 `enterpriseModules` 定义后添加：
```typescript
const customModules = [];
try {
  if (require('./custom/custom.module')?.CustomModule) {
    customModules.push(require('./custom/custom.module')?.CustomModule);
  }
} catch (err) {
  console.log('Custom modules not loaded');
}
```

在 `@Module` 的 `imports` 数组中添加：
```typescript
@Module({
  imports: [
    // ... 现有模块
    ...enterpriseModules,
    ...customModules,  // 🆕 添加这一行
  ],
})
```

### 第四步：验证设置

```bash
# 启动开发服务器
pnpm dev

# 查看日志，应该看到 "Custom modules not loaded" 或成功加载
```

## ✅ 设置完成！

现在您已经有了一个完整的插件化架构基础。所有自定义代码都将放在 `custom/` 目录中。

---

## 📁 目录结构说明

```
docmost/
├── apps/
│   ├── server/src/
│   │   ├── custom/                    # 🆕 所有自定义后端代码
│   │   │   ├── custom.module.ts       # 自定义模块入口
│   │   │   ├── oidc/                  # OIDC SSO 功能
│   │   │   ├── block/                 # Block 系统功能
│   │   │   └── migrations/            # 自定义数据库迁移
│   │   └── app.module.ts              # ⚠️ 已修改（加载 custom）
│   └── client/src/
│       └── custom/                    # 🆕 所有自定义前端代码
│           ├── extensions/            # Tiptap 扩展
│           └── components/            # React 组件
└── packages/
    └── custom-extensions/             # 🆕 自定义编辑器扩展包
```

---

## 🎯 下一步：开始开发功能

### 选项 1: 开发 OIDC SSO

```bash
# 创建 OIDC 模块
mkdir -p apps/server/src/custom/oidc/{services,strategies,dto}
touch apps/server/src/custom/oidc/oidc.module.ts
```

参考实施计划中的 OIDC 代码示例。

### 选项 2: 开发 Block 系统

```bash
# 创建 Block 模块
mkdir -p apps/server/src/custom/block/{services,dto}
touch apps/server/src/custom/block/block.module.ts

# 创建 migration
touch apps/server/src/custom/migrations/20251120T150000-page_blocks.ts
```

参考实施计划中的 Block 数据模型和 migration 示例。

---

## 🔄 上游同步流程

### 设置上游仓库（首次）

```bash
# 添加上游仓库
git remote add upstream https://github.com/docmost/docmost.git

# 验证
git remote -v
```

### 半年一次的更新流程

```bash
# 1. 拉取上游最新代码
git fetch upstream

# 2. 查看变更
git log upstream/main --oneline --since="6 months ago"

# 3. 合并上游更新
git merge upstream/main

# 4. 解决冲突（如果有）
# 由于自定义代码在 custom/ 目录，冲突极少

# 5. 测试
pnpm install
pnpm dev

# 6. 运行 migrations
pnpm migration:run
```

---

## 📝 开发规范

### ✅ DO（推荐做法）

- ✅ 所有自定义代码放在 `custom/` 目录
- ✅ 使用环境变量控制功能开关
- ✅ 编写单元测试
- ✅ 记录对核心文件的修改（在 CUSTOM_CHANGES.md）
- ✅ 使用独立的 migration 文件

### ❌ DON'T（避免做法）

- ❌ 直接修改核心模块代码
- ❌ 在核心文件中硬编码自定义逻辑
- ❌ 修改现有的 migration 文件
- ❌ 删除或重命名核心文件

---

## 🛠️ 常用命令

```bash
# 开发模式
pnpm dev

# 构建
pnpm build

# 运行 migrations
pnpm --filter ./apps/server run migration:run

# 创建新 migration
pnpm --filter ./apps/server run migration:create

# 测试
pnpm test

# 类型检查
pnpm --filter ./apps/server run type-check
```

---

## 📚 参考资源

- [完整实施计划](file:///Users/zhoukai/.gemini/antigravity/brain/f9e79a01-74eb-44ce-a584-4606f8ae8925/implementation_plan.md)
- [Docmost 官方文档](https://docmost.com/docs)
- [NestJS 模块文档](https://docs.nestjs.com/modules)
- [Tiptap 扩展开发](https://tiptap.dev/docs/editor/extensions/custom-extensions)

---

## 🆘 故障排除

### 问题：自定义模块未加载

**解决方案**：
1. 检查 `custom.module.ts` 是否正确导出
2. 检查 `app.module.ts` 中的导入路径
3. 查看控制台日志

### 问题：上游合并冲突

**解决方案**：
```bash
# 如果 app.module.ts 冲突
git checkout --ours apps/server/src/app.module.ts
# 然后手动检查上游是否有新模块需要添加
```

### 问题：Migration 执行失败

**解决方案**：
1. 检查 migration 文件命名格式
2. 确保 migration 在 `custom/migrations/index.ts` 中导出
3. 检查数据库连接

---

## 📞 支持

如有问题，请参考：
1. 完整实施计划文档
2. Docmost 社区讨论
3. 项目 Issue 追踪

---

**祝开发顺利！🎉**
