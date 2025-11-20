# 自定义修改记录

> 本文件记录所有对 Docmost 核心文件的修改，便于上游同步时快速定位和解决冲突。

## 修改的核心文件

### 1. `apps/server/src/app.module.ts`

**修改原因**: 加载自定义模块

**修改内容**:
- 添加导入: `import { CustomModule } from './custom/custom.module';`
- 添加动态加载逻辑（参考 enterpriseModules 模式）
- 在 `@Module` imports 中添加 `...customModules`

**代码片段**:
```typescript
// 在 enterpriseModules 后添加
const customModules = [];
try {
  if (require('./custom/custom.module')?.CustomModule) {
    customModules.push(require('./custom/custom.module')?.CustomModule);
  }
} catch (err) {
  console.log('Custom modules not loaded');
}

@Module({
  imports: [
    // ... 现有模块
    ...enterpriseModules,
    ...customModules,  // 🆕 添加这一行
  ],
})
```

**上游同步注意事项**:
- 如果上游修改了 `app.module.ts`，需要手动合并
- 确保 `customModules` 在 `enterpriseModules` 之后加载
- 检查上游是否添加了新的核心模块

---

### 2. `apps/server/src/database/database.module.ts` (可选)

**修改原因**: 加载自定义 migrations

**修改内容**:
- 添加导入: `import * as customMigrations from '../custom/migrations';`
- 合并 migrations: `...customMigrations`

**代码片段**:
```typescript
import * as customMigrations from '../custom/migrations';

const allMigrations = {
  ...migrations,
  ...customMigrations,
};
```

**上游同步注意事项**:
- 如果上游修改了 migration 加载逻辑，需要适配
- 确保自定义 migrations 不与上游冲突（使用不同的时间戳前缀）

---

## 新增的目录和文件

### 后端
- `apps/server/src/custom/` - 所有自定义后端代码
- `apps/server/src/custom/custom.module.ts` - 自定义模块入口
- `apps/server/src/custom/oidc/` - OIDC SSO 功能
- `apps/server/src/custom/block/` - Block 系统功能
- `apps/server/src/custom/migrations/` - 自定义数据库迁移

### 前端
- `apps/client/src/custom/` - 所有自定义前端代码
- `apps/client/src/custom/extensions/` - Tiptap 扩展
- `apps/client/src/custom/components/` - React 组件

### 扩展包
- `packages/custom-extensions/` - 自定义编辑器扩展包

---

## 环境变量

新增的环境变量（在 `.env` 文件中）:

```env
# 自定义功能开关
CUSTOM_FEATURES_ENABLED=true
CUSTOM_OIDC_ENABLED=true
CUSTOM_BLOCK_SYSTEM_ENABLED=false
```

---

## 依赖变更

### 新增依赖

**后端** (用于 OIDC SSO):
```json
{
  "@nestjs/passport": "^10.x.x",
  "passport": "^0.7.0",
  "openid-client": "^5.x.x"
}
```

**前端**:
```json
{
  "@tanstack/react-query": "^5.x.x"
}
```

---

## 数据库变更

### 自定义 Migrations

| Migration | 描述 | 状态 |
|-----------|------|------|
| (无需新 migration) | 使用现有 auth_providers 表 | ✅ 已存在 |
| `20251120T150000-page_blocks.ts` | 创建 page_blocks 表 | 待执行 |
| `20251120T160000-migrate-pages-to-blocks.ts` | 迁移现有数据 | 待执行 |

---

## 版本信息

- **基于 Docmost 版本**: v0.23.2
- **自定义版本**: v1.0.0-alpha
- **最后同步日期**: 2025-11-20

### 功能状态

| 功能 | 状态 | 分支 |
|------|------|------|
| OIDC SSO | 🚧 开发中 | feature/oidc-sso |
| Block 系统 | 📋 规划中 | - |
| 引用块 | 📋 规划中 | - |
| 同步块 | 📋 规划中 | - |

---

## 上游同步检查清单

每次从上游同步时，检查以下项目：

- [ ] `app.module.ts` 是否有冲突
- [ ] `database.module.ts` 是否有冲突
- [ ] 上游是否添加了新的核心模块
- [ ] 上游是否修改了 migration 系统
- [ ] 上游是否更新了依赖版本
- [ ] 运行测试确保自定义功能正常
- [ ] 更新本文档的版本信息

---

**最后更新**: 2025-11-20
