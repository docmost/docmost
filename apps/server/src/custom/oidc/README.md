# OIDC SSO Plugin

本插件为 Docmost 添加了 OIDC (OpenID Connect) 单点登录功能。

## 功能特性

- ✅ 支持标准 OIDC 协议
- ✅ 自动用户创建和关联
- ✅ 基于环境变量的功能开关
- ✅ 完全插件化，不修改核心代码

## 文件结构

```
apps/server/src/custom/oidc/
├── types/
│   └── oidc.types.ts           # OIDC 类型定义
├── services/
│   └── oidc.service.ts         # OIDC 业务逻辑
├── strategies/
│   └── oidc.strategy.ts        # Passport OIDC 策略
├── oidc.controller.ts          # OIDC 路由控制器
└── oidc.module.ts              # OIDC 模块定义
```

## 数据库依赖

使用 Docmost 现有的数据库表：
- `auth_providers` - 存储 OIDC 提供商配置
- `auth_accounts` - 存储用户与 OIDC 账户的关联
- `users` - 存储用户信息

## API 端点

### 1. 初始化登录流程
```
GET /auth/oidc/login?workspace=<workspace_id>
```
重定向用户到 OIDC 提供商进行认证。

### 2. 处理回调
```
GET /auth/oidc/callback
```
OIDC 提供商认证成功后的回调地址。

### 3. 获取配置
```
GET /auth/oidc/config?workspace=<workspace_id>
```
返回工作区的 OIDC 配置状态。

## 配置要求

### 环境变量
```env
# 启用/禁用 OIDC 功能（默认启用）
CUSTOM_OIDC_ENABLED=true
```

### 数据库配置

在 `auth_providers` 表中配置（通过管理界面）：
- `type`: 'oidc'
- `oidc_issuer`: OIDC 提供商的 issuer URL
- `oidc_client_id`: 客户端 ID
- `oidc_client_secret`: 客户端密钥
- `is_enabled`: true
- `allow_signup`: true/false（是否允许自动创建用户）

## 工作流程

1. 用户选择 OIDC 登录
2. 系统重定向到 OIDC 提供商
3. 用户在 OIDC 提供商处认证
4. OIDC 提供商回调 Docmost
5. 系统验证 token 并获取用户信息
6. 查找或创建用户账户
7. 创建/更新 auth_account 关联
8. 生成 JWT token 并登录

## 依赖包

```json
{
  "@nestjs/passport": "^10.x.x",
  "passport": "^0.7.0",
  "openid-client": "^5.x.x"
}
```

## 安全考虑

- ✅ 使用 HTTPS 保护回调端点
- ✅ 验证 OIDC token 签名
- ✅ 支持工作区级别的配置隔离
- ✅ 可控制的用户自动注册

## 后续优化

- [ ] 添加 PKCE 支持
- [ ] 支持多个 OIDC 提供商
- [ ] 添加用户属性映射配置
- [ ] 实现 token 刷新机制
- [ ] 添加详细的日志记录

## 测试

待实现单元测试和集成测试。

## 使用文档

详见主项目的 [CUSTOM_SETUP_GUIDE.md](../../CUSTOM_SETUP_GUIDE.md)
