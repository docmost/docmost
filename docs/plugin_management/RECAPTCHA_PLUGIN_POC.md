# reCAPTCHA v3 Plugin PoC - Detailed Specification

**Document**: Complete Implementation Guide  
**Version**: 1.0  
**Status**: Ready for Implementation  
**Scope**: Plugin Management System + reCAPTCHA v3 Integration  
**Estimated Effort**: 4-6 weeks

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Design](#architecture-design)
3. [Database Schema](#database-schema)
4. [API Design](#api-design)
5. [Frontend Design](#frontend-design)
6. [reCAPTCHA v3 Integration](#recaptcha-v3-integration)
7. [Implementation Plan](#implementation-plan)
8. [Code Examples](#code-examples)

---

## Overview

### What We're Building

A **plugin management system** with **reCAPTCHA v3** as the first plugin, demonstrating:

1. **Plugin Management UI** (Workspace Admin)
   - List all available plugins
   - Enable/disable plugins per workspace
   - Configure plugin credentials
   - View plugin status & health

2. **reCAPTCHA v3 Integration**
   - Protect signup/login forms
   - Server-side verification
   - Score-based bot detection
   - Configurable thresholds

3. **Plugin Architecture** (Extensible for future plugins)
   - Plugin discovery & loading
   - Configuration management
   - Hook system
   - Type-safe plugin API

### Success Criteria

- ✅ Workspace admin can enable/disable reCAPTCHA v3
- ✅ Workspace admin can configure reCAPTCHA credentials
- ✅ reCAPTCHA protection active on login/signup forms
- ✅ Server validates reCAPTCHA tokens
- ✅ System logs reCAPTCHA events for monitoring
- ✅ Plugin can be disabled without code changes
- ✅ Architecture supports adding more plugins later

---

## Architecture Design

### High-Level Layers

```
┌─────────────────────────────────────────────────┐
│           Frontend (React + TypeScript)          │
│  Plugin Management UI | reCAPTCHA Widget Render │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│        Plugin API Gateway (NestJS)              │
│  /api/plugins/* | /api/plugins/{id}/config      │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│       Plugin Manager Service (Core)             │
│  Registry | Loader | Config Manager             │
└──────────────────────┬──────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
┌───▼────────┐  ┌─────▼──────┐  ┌───────▼───┐
│ Plugin:    │  │ Plugin:    │  │ Plugin:   │
│ reCAPTCHA  │  │ (Future 1) │  │(Future 2) │
└────────────┘  └────────────┘  └───────────┘
    │
    └─► reCAPTCHA Service
        └─► Google reCAPTCHA API
```

### Core Components

#### 1. Plugin Manager (Server-side)

**Responsibilities:**
- Plugin discovery from `plugins/` directory
- Dynamic module loading
- Configuration CRUD
- Plugin lifecycle management

**Key Classes:**
```typescript
// Plugin Manager
class PluginManager {
  async discoverPlugins(): Promise<PluginMetadata[]>
  async loadPlugin(pluginId: string): Promise<void>
  async unloadPlugin(pluginId: string): Promise<void>
  async getPluginConfig(workspaceId, pluginId): Promise<Config>
  async updatePluginConfig(workspaceId, pluginId, config): Promise<void>
  async isPluginEnabled(workspaceId, pluginId): Promise<boolean>
}

// Plugin Registry
class PluginRegistry {
  register(plugin: Plugin): void
  get(pluginId: string): Plugin
  getAll(): Plugin[]
  has(pluginId: string): boolean
}

// Plugin Metadata
interface PluginMetadata {
  id: string
  name: string
  version: string
  description: string
  author: string
  configSchema: JSONSchema
  requiredPermissions: string[]
  hooks: string[]
  frontend: {
    entry: string
    assets: string[]
  }
  backend: {
    entry: string
    migrations: string[]
  }
}
```

#### 2. Plugin Configuration System

**Storage:**
```typescript
interface PluginConfiguration {
  id: string (UUID)
  workspace_id: UUID
  plugin_id: string
  enabled: boolean
  config: JSONB (encrypted for sensitive data)
  created_at: timestamp
  updated_at: timestamp
  created_by: UUID
  version: int (for optimistic locking)
}

interface PluginAuditLog {
  id: UUID
  workspace_id: UUID
  plugin_id: string
  action: 'enabled' | 'disabled' | 'config_updated' | 'installed' | 'uninstalled'
  changes: JSONB
  performed_by: UUID
  created_at: timestamp
}
```

#### 3. reCAPTCHA Plugin Architecture

```typescript
// Plugin structure
plugins/recaptcha-v3/
├── plugin.config.json          # Metadata
├── src/
│   ├── backend/
│   │   ├── recaptcha.service.ts
│   │   ├── recaptcha.controller.ts
│   │   ├── recaptcha.module.ts
│   │   ├── recaptcha.types.ts
│   │   └── hooks.ts
│   ├── frontend/
│   │   ├── RecaptchaProvider.tsx
│   │   ├── useRecaptcha.ts
│   │   ├── RecaptchaConfig.tsx
│   │   ├── RecaptchaWidget.tsx
│   │   └── hooks.ts
│   └── migrations/
│       └── 001_create_recaptcha_logs.sql
├── dist/                       # Built output
├── package.json
└── tsconfig.json
```

#### 4. Hook System

```typescript
// Plugin can register hooks for core events
interface HookRegistry {
  on(eventName: string, handler: Function): void
  once(eventName: string, handler: Function): void
  off(eventName: string, handler: Function): void
  emit(eventName: string, ...args: any[]): Promise<void>
}

// Core events for plugins
enum CoreHooks {
  // Auth events
  BEFORE_LOGIN = 'auth:beforeLogin',
  AFTER_LOGIN = 'auth:afterLogin',
  BEFORE_SIGNUP = 'auth:beforeSignup',
  AFTER_SIGNUP = 'auth:afterSignup',
  
  // Page events
  BEFORE_PAGE_CREATE = 'page:beforeCreate',
  AFTER_PAGE_CREATE = 'page:afterCreate',
  
  // Plugin lifecycle
  ON_PLUGIN_ENABLE = 'plugin:onEnable',
  ON_PLUGIN_DISABLE = 'plugin:onDisable'
}

// reCAPTCHA would hook into:
hookRegistry.on(CoreHooks.BEFORE_LOGIN, verifyRecaptcha)
hookRegistry.on(CoreHooks.BEFORE_SIGNUP, verifyRecaptcha)
```

---

## Database Schema

### Plugin Configuration Tables

```sql
-- Plugin Registry (what's available)
CREATE TABLE plugin_definitions (
  id VARCHAR(50) PRIMARY KEY,           -- 'recaptcha-v3'
  name VARCHAR(255) NOT NULL,
  version VARCHAR(20) NOT NULL,
  description TEXT,
  author VARCHAR(255),
  config_schema JSONB,                  -- JSON Schema for validation
  required_permissions TEXT[],
  hooks TEXT[],
  backend_entry VARCHAR(255),
  backend_migrations TEXT[],
  frontend_entry VARCHAR(255),
  frontend_assets TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Plugin Configuration per Workspace
CREATE TABLE plugin_configurations (
  id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plugin_id VARCHAR(50) NOT NULL REFERENCES plugin_definitions(id),
  enabled BOOLEAN DEFAULT FALSE,
  config JSONB,                         -- Encrypted for credentials
  config_encrypted_fields TEXT[],       -- Which fields are encrypted
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id) SET NULL,
  updated_by UUID REFERENCES users(id) SET NULL,
  version INT DEFAULT 1,                -- For optimistic locking
  
  UNIQUE(workspace_id, plugin_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

-- Plugin Audit Log
CREATE TABLE plugin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plugin_id VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_config JSONB,
  new_config JSONB,
  performed_by UUID REFERENCES users(id) SET NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

-- reCAPTCHA Verification Logs (for monitoring)
CREATE TABLE recaptcha_verifications (
  id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,           -- 'login', 'signup'
  score FLOAT NOT NULL,                  -- reCAPTCHA score 0.0-1.0
  is_bot BOOLEAN,                        -- true if score < threshold
  error TEXT,                            -- Error message if verification failed
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

-- Indexes
CREATE INDEX idx_plugin_configs_workspace ON plugin_configurations(workspace_id);
CREATE INDEX idx_plugin_configs_plugin ON plugin_configurations(plugin_id);
CREATE INDEX idx_plugin_audit_workspace ON plugin_audit_logs(workspace_id);
CREATE INDEX idx_recaptcha_workspace ON recaptcha_verifications(workspace_id);
CREATE INDEX idx_recaptcha_created ON recaptcha_verifications(created_at);
```

---

## API Design

### Plugin Management Endpoints

#### 1. List Plugins

```http
GET /api/plugins
Authorization: Bearer {token}

Response 200:
{
  "plugins": [
    {
      "id": "recaptcha-v3",
      "name": "reCAPTCHA v3",
      "version": "1.0.0",
      "description": "Bot protection using Google reCAPTCHA v3",
      "author": "Docmost",
      "enabled": true,                    # Per workspace
      "configured": true,                 # Has valid config
      "config": {
        "siteKey": "6Le...",
        "enabled": true,
        "threshold": 0.5,
        "actions": ["login", "signup"]
      }
    }
  ]
}
```

#### 2. Get Plugin Details

```http
GET /api/plugins/recaptcha-v3
Authorization: Bearer {token}

Response 200:
{
  "id": "recaptcha-v3",
  "name": "reCAPTCHA v3",
  "version": "1.0.0",
  "description": "...",
  "configSchema": {
    "type": "object",
    "properties": {
      "siteKey": { "type": "string", "required": true },
      "secretKey": { "type": "string", "required": true },
      "threshold": { "type": "number", "min": 0, "max": 1 },
      "actions": { "type": "array", "items": { "type": "string" } },
      "enabled": { "type": "boolean" }
    }
  },
  "status": "installed",                 # installed | not-installed
  "canUninstall": false,                 # Built-in plugins
  "permissions": []
}
```

#### 3. Get Plugin Configuration

```http
GET /api/plugins/recaptcha-v3/config
Authorization: Bearer {token}

Response 200:
{
  "id": "uuid",
  "pluginId": "recaptcha-v3",
  "enabled": true,
  "config": {
    "siteKey": "6Le...",
    "secretKey": "***REDACTED***",      # Don't return secret to frontend
    "threshold": 0.5,
    "actions": ["login", "signup"],
    "enabled": true
  },
  "lastUpdated": "2026-06-27T12:00:00Z",
  "updatedBy": { "id": "...", "email": "admin@example.com" }
}
```

#### 4. Update Plugin Configuration

```http
PUT /api/plugins/recaptcha-v3/config
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "enabled": true,
  "config": {
    "siteKey": "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
    "secretKey": "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe",
    "threshold": 0.7,
    "actions": ["login", "signup"],
    "enabled": true
  }
}

Response 200:
{
  "id": "uuid",
  "pluginId": "recaptcha-v3",
  "enabled": true,
  "config": { ... }
}
```

#### 5. Enable/Disable Plugin

```http
POST /api/plugins/recaptcha-v3/toggle
Authorization: Bearer {token}

Request:
{
  "enabled": true
}

Response 200:
{
  "enabled": true,
  "message": "Plugin enabled successfully"
}
```

#### 6. Plugin Audit Log

```http
GET /api/plugins/audit-logs?pluginId=recaptcha-v3&limit=50
Authorization: Bearer {token}

Response 200:
{
  "logs": [
    {
      "id": "uuid",
      "pluginId": "recaptcha-v3",
      "action": "config_updated",
      "changes": {
        "threshold": { "old": 0.5, "new": 0.7 }
      },
      "performedBy": { "id": "...", "email": "admin@example.com" },
      "createdAt": "2026-06-27T12:00:00Z"
    }
  ],
  "total": 42
}
```

#### 7. reCAPTCHA Verification Status

```http
GET /api/plugins/recaptcha-v3/verification-stats?days=7
Authorization: Bearer {token}

Response 200:
{
  "totalVerifications": 1250,
  "botsDetected": 45,
  "botPercentage": 3.6,
  "averageScore": 0.92,
  "failedVerifications": 3,
  "byAction": {
    "login": { "total": 800, "botsDetected": 30, "avgScore": 0.94 },
    "signup": { "total": 450, "botsDetected": 15, "avgScore": 0.88 }
  }
}
```

### reCAPTCHA Verification Endpoints (Internal/Hook)

```http
POST /api/plugins/recaptcha-v3/verify
Authorization: Bearer {internalToken}
Content-Type: application/json

Request:
{
  "token": "0AYrXx...",                  # From client
  "action": "login",                    # login | signup
  "userIp": "192.168.1.1"
}

Response 200:
{
  "success": true,
  "score": 0.92,
  "action": "login",
  "challengeTs": "2026-06-27T12:00:00Z",
  "hostname": "example.com",
  "isBot": false,
  "errorCodes": []
}
```

---

## Frontend Design

### 1. Plugin Management UI

**Location**: `/workspace/{workspaceId}/settings/plugins`

**Layout:**
```
┌────────────────────────────────────────┐
│        Plugin Management                │
├────────────────────────────────────────┤
│                                        │
│  Available Plugins:                   │
│  ┌──────────────────────────────────┐ │
│  │ reCAPTCHA v3                   │ │ │
│  │ Bot protection using Google    │O│ │  ← Toggle enable/disable
│  │ ────────────────────────────────│ │
│  │ Version: 1.0.0                 │ │
│  │ Status: ✓ Installed, Enabled   │ │
│  │ [Configure] [View Logs] [Docs] │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ (Future Plugin)                │O│ │
│  │ ...                             │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

**React Component Structure:**

```typescript
// /apps/client/src/ee/plugins/pages/plugin-settings.tsx
export function PluginSettingsPage() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null)
  
  return (
    <div>
      <h1>Plugin Management</h1>
      <PluginList
        plugins={plugins}
        onSelect={setSelectedPlugin}
        onToggle={handleTogglePlugin}
      />
      {selectedPlugin && (
        <PluginConfigPanel
          pluginId={selectedPlugin}
          onClose={() => setSelectedPlugin(null)}
        />
      )}
    </div>
  )
}

// /apps/client/src/ee/plugins/components/plugin-list.tsx
export function PluginList({ plugins, onSelect, onToggle }: PluginListProps) {
  return (
    <div className="plugin-list">
      {plugins.map(plugin => (
        <PluginCard
          key={plugin.id}
          plugin={plugin}
          onSelect={() => onSelect(plugin.id)}
          onToggle={() => onToggle(plugin.id)}
        />
      ))}
    </div>
  )
}

// Plugin Card
function PluginCard({ plugin, onSelect, onToggle }: PluginCardProps) {
  return (
    <Card>
      <div className="flex justify-between items-start">
        <div>
          <h3>{plugin.name}</h3>
          <p>{plugin.description}</p>
          <p className="text-sm text-gray-500">v{plugin.version}</p>
          <div className="status">
            {plugin.enabled ? (
              <span className="badge badge-success">Enabled</span>
            ) : (
              <span className="badge badge-gray">Disabled</span>
            )}
            {plugin.configured ? (
              <span className="badge badge-info">Configured</span>
            ) : (
              <span className="badge badge-warning">Not Configured</span>
            )}
          </div>
        </div>
        <div className="actions">
          <Toggle
            checked={plugin.enabled}
            onChange={onToggle}
          />
          <Button onClick={onSelect}>Configure</Button>
          <Menu>
            <MenuItem>View Logs</MenuItem>
            <MenuItem>Documentation</MenuItem>
          </Menu>
        </div>
      </div>
    </Card>
  )
}
```

### 2. reCAPTCHA Configuration UI

**Component:** `RecaptchaConfigPanel`

```typescript
// /apps/client/src/ee/plugins/recaptcha/components/recaptcha-config.tsx
export function RecaptchaConfigPanel({ onClose }: Props) {
  const [config, setConfig] = useState<RecaptchaConfig | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const handleSubmit = async (formData: RecaptchaConfig) => {
    setIsSaving(true)
    try {
      await updatePluginConfig('recaptcha-v3', formData)
      toast.success('Configuration saved')
      onClose()
    } catch (error) {
      setErrors(error.fieldErrors || {})
    } finally {
      setIsSaving(false)
    }
  }
  
  return (
    <Modal title="Configure reCAPTCHA v3" onClose={onClose}>
      <Form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Site Key */}
          <FormField
            label="Site Key"
            description="Public key from Google reCAPTCHA console"
            error={errors.siteKey}
          >
            <Input
              name="siteKey"
              defaultValue={config?.siteKey}
              placeholder="6LeIxAcT..."
              required
            />
          </FormField>
          
          {/* Secret Key */}
          <FormField
            label="Secret Key"
            description="Private key from Google reCAPTCHA console"
            error={errors.secretKey}
          >
            <Input
              name="secretKey"
              type="password"
              defaultValue={config?.secretKey ? '••••••••' : ''}
              placeholder="Enter your secret key"
              required
            />
            <p className="text-xs text-gray-500">
              Secret key is encrypted and never shown after save
            </p>
          </FormField>
          
          {/* Threshold */}
          <FormField
            label="Bot Detection Threshold"
            description="Score below this value is considered a bot (0.0-1.0)"
            error={errors.threshold}
          >
            <div className="flex items-center gap-4">
              <Slider
                name="threshold"
                min={0}
                max={1}
                step={0.1}
                defaultValue={config?.threshold || 0.5}
              />
              <Input
                name="threshold"
                type="number"
                min={0}
                max={1}
                step={0.1}
                className="w-20"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Current: {config?.threshold || 0.5}
            </p>
          </FormField>
          
          {/* Actions */}
          <FormField label="Protected Actions">
            <Checkbox name="actions.login">
              <span>Protect Login Form</span>
            </Checkbox>
            <Checkbox name="actions.signup">
              <span>Protect Signup Form</span>
            </Checkbox>
          </FormField>
          
          {/* Enabled Toggle */}
          <FormField label="Status">
            <Toggle
              name="enabled"
              defaultChecked={config?.enabled}
            >
              <span>Enable reCAPTCHA Protection</span>
            </Toggle>
          </FormField>
          
          {/* Test Credentials */}
          <Card className="bg-blue-50">
            <p className="text-sm font-semibold mb-2">Test Credentials</p>
            <p className="text-xs text-gray-600">
              For testing, you can use Google's demo site key:
            </p>
            <code className="text-xs block mt-2 p-2 bg-white rounded">
              6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
            </code>
          </Card>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isSaving}
          >
            Save Configuration
          </Button>
        </div>
      </Form>
    </Modal>
  )
}
```

### 3. reCAPTCHA Widget Component

```typescript
// /apps/client/src/ee/plugins/recaptcha/components/recaptcha-widget.tsx
export function RecaptchaWidget({ action }: { action: 'login' | 'signup' }) {
  const { executeRecaptcha } = useRecaptcha()
  const [loading, setLoading] = useState(false)
  
  const handleFormSubmit = async (formData: FormData) => {
    setLoading(true)
    try {
      // Get reCAPTCHA token from Google
      const token = await executeRecaptcha(action)
      
      // Include token in form submission
      const data = new FormData(formData)
      data.append('recaptchaToken', token)
      
      // Submit form with token
      await submitForm(data)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <>
      {/* Hidden reCAPTCHA script injection */}
      <div
        className="g_recaptcha"
        data-sitekey={process.env.VITE_RECAPTCHA_SITE_KEY}
      />
      {/* Form uses RecaptchaContext */}
    </>
  )
}

// Hook for easy access
export function useRecaptcha() {
  const context = useContext(RecaptchaContext)
  if (!context) {
    throw new Error('useRecaptcha must be used within RecaptchaProvider')
  }
  return context
}

// Provider setup
export function RecaptchaProvider({ children }: Props) {
  const [isEnabled, setIsEnabled] = useState(false)
  const [siteKey, setSiteKey] = useState<string>('')
  
  useEffect(() => {
    // Load reCAPTCHA config from plugin API
    loadRecaptchaConfig().then(config => {
      if (config.enabled) {
        setIsEnabled(true)
        setSiteKey(config.siteKey)
        loadRecaptchaScript(config.siteKey)
      }
    })
  }, [])
  
  const executeRecaptcha = useCallback(async (action: string) => {
    if (!isEnabled || !window.grecaptcha) {
      return null
    }
    
    return window.grecaptcha.execute(siteKey, { action })
  }, [isEnabled, siteKey])
  
  return (
    <RecaptchaContext.Provider value={{ executeRecaptcha, isEnabled }}>
      {children}
    </RecaptchaContext.Provider>
  )
}
```

### 4. Integration with Login/Signup Forms

```typescript
// /apps/client/src/features/auth/pages/login.tsx
export function LoginPage() {
  const { executeRecaptcha } = useRecaptcha()
  
  const handleLogin = async (credentials: LoginCredentials) => {
    // Get reCAPTCHA token
    const recaptchaToken = await executeRecaptcha('login')
    
    // Submit login with token
    const response = await loginApi({
      email: credentials.email,
      password: credentials.password,
      recaptchaToken  // Server will verify this
    })
    
    if (response.ok) {
      // Login successful
    }
  }
  
  return (
    <LoginForm onSubmit={handleLogin}>
      {/* Form fields */}
    </LoginForm>
  )
}
```

---

## reCAPTCHA v3 Integration

### Backend Service

```typescript
// plugins/recaptcha-v3/src/backend/recaptcha.service.ts
import { Injectable } from '@nestjs/common'
import axios from 'axios'

interface RecaptchaVerifyRequest {
  token: string
  action: string
  userIp?: string
}

interface RecaptchaVerifyResponse {
  success: boolean
  score: number
  action: string
  challenge_ts: string
  hostname: string
  error_codes?: string[]
}

@Injectable()
export class RecaptchaService {
  private readonly GOOGLE_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'
  
  constructor(
    private configService: PluginConfigService,
    private logger: LoggerService,
    private auditLogger: AuditLogger
  ) {}
  
  async verifyToken(
    workspaceId: string,
    request: RecaptchaVerifyRequest
  ): Promise<{
    isValid: boolean
    score: number
    isBot: boolean
  }> {
    try {
      // Get workspace config
      const config = await this.configService.getConfig(workspaceId)
      
      if (!config.enabled || !config.secretKey) {
        this.logger.warn(
          `reCAPTCHA not configured for workspace ${workspaceId}`
        )
        // Don't block requests if reCAPTCHA is not configured
        return { isValid: true, score: 1.0, isBot: false }
      }
      
      // Verify with Google
      const response = await axios.post<RecaptchaVerifyResponse>(
        this.GOOGLE_VERIFY_URL,
        {
          secret: config.secretKey,
          response: request.token
        }
      )
      
      // Log verification
      await this.logVerification(workspaceId, {
        action: request.action,
        score: response.data.score,
        errorCodes: response.data.error_codes,
        ipAddress: request.userIp,
        success: response.data.success
      })
      
      // Check if score is below threshold
      const isBot = response.data.score < (config.threshold || 0.5)
      
      return {
        isValid: response.data.success,
        score: response.data.score,
        isBot
      }
    } catch (error) {
      this.logger.error(
        `reCAPTCHA verification failed: ${error.message}`
      )
      
      // Log error
      await this.logVerificationError(workspaceId, error)
      
      // Don't block on verification errors
      return { isValid: true, score: 1.0, isBot: false }
    }
  }
  
  private async logVerification(
    workspaceId: string,
    data: {
      action: string
      score: number
      errorCodes?: string[]
      ipAddress?: string
      success: boolean
    }
  ): Promise<void> {
    // Store in recaptcha_verifications table
    await this.auditLogger.log({
      type: 'RECAPTCHA_VERIFICATION',
      workspaceId,
      data
    })
  }
  
  private async logVerificationError(
    workspaceId: string,
    error: Error
  ): Promise<void> {
    await this.auditLogger.log({
      type: 'RECAPTCHA_ERROR',
      workspaceId,
      data: { error: error.message }
    })
  }
}
```

### Plugin Hook Integration

```typescript
// plugins/recaptcha-v3/src/backend/hooks.ts
import { RecaptchaService } from './recaptcha.service'
import { HookRegistry, CoreHooks } from '@docmost/plugin-api'

export function registerHooks(
  hooks: HookRegistry,
  recaptchaService: RecaptchaService
) {
  // Hook into login flow
  hooks.on(CoreHooks.BEFORE_LOGIN, async (context) => {
    const { workspaceId, recaptchaToken, userIp } = context
    
    const { isBot, score } = await recaptchaService.verifyToken(workspaceId, {
      token: recaptchaToken,
      action: 'login',
      userIp
    })
    
    if (isBot) {
      throw new BotDetectedException(
        `Bot detected (score: ${score.toFixed(2)})`
      )
    }
    
    return context
  })
  
  // Hook into signup flow
  hooks.on(CoreHooks.BEFORE_SIGNUP, async (context) => {
    const { workspaceId, recaptchaToken, userIp } = context
    
    const { isBot, score } = await recaptchaService.verifyToken(workspaceId, {
      token: recaptchaToken,
      action: 'signup',
      userIp
    })
    
    if (isBot) {
      throw new BotDetectedException(
        `Bot detected (score: ${score.toFixed(2)})`
      )
    }
    
    return context
  })
}
```

### Controller Endpoints

```typescript
// plugins/recaptcha-v3/src/backend/recaptcha.controller.ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'
import { RecaptchaService } from './recaptcha.service'
import { PluginConfigService } from '@docmost/plugin-api'

@Controller('api/plugins/recaptcha-v3')
export class RecaptchaController {
  constructor(
    private recaptchaService: RecaptchaService,
    private configService: PluginConfigService
  ) {}
  
  @Post('verify')
  async verifyToken(@Body() body: VerifyTokenRequest) {
    const result = await this.recaptchaService.verifyToken(
      body.workspaceId,
      {
        token: body.token,
        action: body.action,
        userIp: body.userIp
      }
    )
    
    return {
      success: result.isValid,
      score: result.score,
      isBot: result.isBot
    }
  }
  
  @Get('verification-stats')
  async getVerificationStats(
    @Query('workspaceId') workspaceId: string,
    @Query('days') days: number = 7
  ) {
    // Return statistics from recaptcha_verifications table
    return await this.recaptchaService.getStats(workspaceId, days)
  }
}
```

---

## Implementation Plan

### Phase 1: Plugin Infrastructure (2 weeks)

#### Week 1: Core Plugin System

**Tasks:**
1. Create `PluginManager` service
   - Plugin discovery logic
   - Plugin loading/unloading
   - Plugin registry

2. Create `PluginConfigService`
   - Config CRUD operations
   - Encryption for sensitive fields
   - Version control

3. Database migrations
   - `plugin_definitions` table
   - `plugin_configurations` table
   - `plugin_audit_logs` table

4. Plugin API types & interfaces
   - `PluginMetadata` interface
   - `Plugin` interface
   - Hook system types

**Deliverables:**
- [ ] PluginManager implementation
- [ ] PluginConfigService implementation
- [ ] Database schema & migrations
- [ ] TypeScript types exported in `@docmost/plugin-api` package

#### Week 2: API & Frontend Foundation

**Tasks:**
1. Create plugin management API routes
   - GET /api/plugins
   - GET /api/plugins/{id}
   - GET /api/plugins/{id}/config
   - PUT /api/plugins/{id}/config
   - POST /api/plugins/{id}/toggle
   - GET /api/plugins/audit-logs

2. Access control
   - Only workspace admin can manage plugins
   - Use existing `@RequireWorkspaceAdmin()` decorator

3. Frontend components foundation
   - PluginSettingsPage
   - PluginList
   - PluginCard (basic)

4. Hook system implementation
   - HookRegistry
   - Plugin hook registration
   - Hook event emission

**Deliverables:**
- [ ] All plugin management endpoints
- [ ] Access control validation
- [ ] Basic frontend components
- [ ] Hook system working

---

### Phase 2: reCAPTCHA Plugin PoC (2 weeks)

#### Week 3: reCAPTCHA Backend

**Tasks:**
1. Create plugin directory structure
   ```
   plugins/recaptcha-v3/
   ├── plugin.config.json
   ├── package.json
   ├── tsconfig.json
   ├── src/
   │   ├── backend/
   │   │   ├── recaptcha.service.ts
   │   │   ├── recaptcha.controller.ts
   │   │   ├── recaptcha.module.ts
   │   │   └── hooks.ts
   │   └── migrations/
   │       └── 001_create_recaptcha_logs.sql
   └── dist/
   ```

2. Implement RecaptchaService
   - Token verification logic
   - Score calculation
   - Bot detection
   - Error handling

3. Database table
   - `recaptcha_verifications` table for logging

4. Hook registration
   - BEFORE_LOGIN hook
   - BEFORE_SIGNUP hook

5. Plugin configuration schema
   - Site key validation
   - Secret key validation
   - Threshold validation

**Deliverables:**
- [ ] RecaptchaService implementation
- [ ] Plugin hooks integrated
- [ ] Database table created
- [ ] Configuration validation

#### Week 4: reCAPTCHA Frontend & Integration

**Tasks:**
1. Create RecaptchaProvider
   - Load reCAPTCHA script
   - Manage configuration
   - Expose executeRecaptcha hook

2. Create reCAPTCHA widget
   - Google script injection
   - Token generation

3. Create configuration UI
   - RecaptchaConfigPanel component
   - Site key input
   - Secret key input (masked)
   - Threshold slider
   - Actions checkboxes

4. Integration with login/signup
   - Modify LoginPage
   - Modify SignupPage
   - Add reCAPTCHA token to requests

5. Testing
   - Unit tests for RecaptchaService
   - Integration tests for hooks
   - E2E tests for login/signup with reCAPTCHA

**Deliverables:**
- [ ] RecaptchaProvider component
- [ ] Configuration UI complete
- [ ] Integration with auth pages
- [ ] All tests passing

---

### Phase 3: Monitoring & Polish (1 week)

**Tasks:**
1. Statistics/monitoring endpoints
   - GET /api/plugins/recaptcha-v3/verification-stats
   - Bot detection rate dashboard

2. Error handling
   - Graceful degradation if reCAPTCHA fails
   - Clear error messages in UI

3. Documentation
   - How to setup reCAPTCHA
   - Configuration guide
   - Monitoring guide

4. Security audit
   - Encryption for secret keys
   - Rate limiting on verify endpoint
   - Audit logging

**Deliverables:**
- [ ] Monitoring dashboard
- [ ] Documentation complete
- [ ] Security audit passed
- [ ] PoC ready for demo

---

## Code Examples

### 1. Plugin Metadata File

```json
// plugins/recaptcha-v3/plugin.config.json
{
  "id": "recaptcha-v3",
  "name": "reCAPTCHA v3",
  "version": "1.0.0",
  "description": "Bot protection using Google reCAPTCHA v3",
  "author": "Docmost",
  "requiredPermissions": ["read:workspace-config", "write:workspace-config"],
  "hooks": ["auth:beforeLogin", "auth:beforeSignup"],
  "configSchema": {
    "type": "object",
    "properties": {
      "siteKey": {
        "type": "string",
        "title": "Site Key",
        "description": "Public key from Google reCAPTCHA",
        "minLength": 1,
        "encrypted": false
      },
      "secretKey": {
        "type": "string",
        "title": "Secret Key",
        "description": "Private key from Google reCAPTCHA",
        "minLength": 1,
        "encrypted": true
      },
      "threshold": {
        "type": "number",
        "title": "Bot Detection Threshold",
        "description": "Score below this is considered a bot",
        "minimum": 0,
        "maximum": 1,
        "default": 0.5
      },
      "actions": {
        "type": "array",
        "title": "Protected Actions",
        "items": { "type": "string" },
        "default": ["login", "signup"]
      },
      "enabled": {
        "type": "boolean",
        "title": "Enable Protection",
        "default": true
      }
    },
    "required": ["siteKey", "secretKey"]
  },
  "backend": {
    "entry": "./dist/server/index.js",
    "migrations": ["./migrations/*.sql"]
  },
  "frontend": {
    "entry": "./dist/client/index.js",
    "assets": ["./dist/client/**/*.css"]
  }
}
```

### 2. Plugin Module Registration

```typescript
// apps/server/src/plugins/plugin.registry.ts
import { Injectable } from '@nestjs/common'
import { PluginManager } from './plugin-manager.service'
import * as fs from 'fs'
import * as path from 'path'

@Injectable()
export class PluginRegistry {
  private plugins: Map<string, PluginMetadata> = new Map()
  
  constructor(private pluginManager: PluginManager) {
    this.discoverPlugins()
  }
  
  private discoverPlugins() {
    const pluginsDir = path.join(process.cwd(), 'plugins')
    
    if (!fs.existsSync(pluginsDir)) {
      return
    }
    
    const entries = fs.readdirSync(pluginsDir)
    
    for (const entry of entries) {
      const configPath = path.join(pluginsDir, entry, 'plugin.config.json')
      
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        this.plugins.set(config.id, config)
      }
    }
  }
  
  getPlugin(id: string): PluginMetadata | undefined {
    return this.plugins.get(id)
  }
  
  getAllPlugins(): PluginMetadata[] {
    return Array.from(this.plugins.values())
  }
}
```

### 3. Plugin API Facade

```typescript
// @docmost/plugin-api/src/plugin-api.ts
export class PluginApi {
  constructor(
    private configService: PluginConfigService,
    private hookRegistry: HookRegistry,
    private database: Database
  ) {}
  
  // Safe, versioned API for plugins
  
  async getConfig<T = Record<string, any>>(
    workspaceId: string,
    pluginId: string
  ): Promise<T> {
    return this.configService.getConfig<T>(workspaceId, pluginId)
  }
  
  async updateConfig<T = Record<string, any>>(
    workspaceId: string,
    pluginId: string,
    config: T
  ): Promise<void> {
    await this.configService.updateConfig(workspaceId, pluginId, config)
  }
  
  onHook(event: string, handler: (...args: any[]) => Promise<any>) {
    this.hookRegistry.on(event, handler)
  }
  
  // Database access through safe queries
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    // Validate SQL against whitelist of allowed patterns
    return this.database.raw(sql, params)
  }
}
```

---

## File Structure Summary

```
docmost/
├── apps/
│   ├── client/
│   │   └── src/
│   │       └── ee/
│   │           └── plugins/
│   │               ├── pages/
│   │               │   └── plugin-settings.tsx
│   │               ├── components/
│   │               │   ├── plugin-list.tsx
│   │               │   ├── plugin-card.tsx
│   │               │   └── plugin-config-panel.tsx
│   │               ├── recaptcha/
│   │               │   ├── components/
│   │               │   │   ├── recaptcha-config.tsx
│   │               │   │   ├── recaptcha-widget.tsx
│   │               │   │   ├── recaptcha-provider.tsx
│   │               │   │   └── recaptcha-context.ts
│   │               │   ├── hooks/
│   │               │   │   └── use-recaptcha.ts
│   │               │   ├── services/
│   │               │   │   └── recaptcha-api.ts
│   │               │   └── index.ts
│   │               ├── hooks/
│   │               │   └── use-plugin-config.ts
│   │               ├── services/
│   │               │   └── plugin-api.ts
│   │               └── types/
│   │                   └── plugin.types.ts
│   └── server/
│       └── src/
│           ├── plugins/
│           │   ├── plugin.manager.ts
│           │   ├── plugin.registry.ts
│           │   ├── plugin.controller.ts
│           │   └── plugin.module.ts
│           ├── ee/
│           │   └── plugins/
│           │       ├── plugin-config/
│           │       │   ├── plugin-config.service.ts
│           │       │   ├── plugin-config.repository.ts
│           │       │   └── plugin-config.types.ts
│           │       └── hook/
│           │           ├── hook.registry.ts
│           │           └── hook.types.ts
│           └── database/
│               └── migrations/
│                   ├── 20260627_plugin_definitions.sql
│                   ├── 20260627_plugin_configurations.sql
│                   ├── 20260627_plugin_audit_logs.sql
│                   └── 20260627_recaptcha_verifications.sql
└── plugins/
    └── recaptcha-v3/
        ├── plugin.config.json
        ├── package.json
        ├── tsconfig.json
        ├── src/
        │   ├── backend/
        │   │   ├── recaptcha.service.ts
        │   │   ├── recaptcha.controller.ts
        │   │   ├── recaptcha.module.ts
        │   │   └── hooks.ts
        │   ├── frontend/
        │   │   ├── recaptcha-provider.tsx
        │   │   ├── recaptcha-widget.tsx
        │   │   ├── use-recaptcha.ts
        │   │   └── recaptcha-config.tsx
        │   ├── migrations/
        │   │   └── 001_create_recaptcha_logs.sql
        │   └── types/
        │       └── recaptcha.types.ts
        └── dist/

packages/
└── plugin-api/
    ├── src/
    │   ├── index.ts
    │   ├── plugin-api.ts
    │   ├── hook-registry.ts
    │   ├── config-service.ts
    │   └── types.ts
    └── package.json
```

---

## Testing Strategy

### Unit Tests

```typescript
// plugins/recaptcha-v3/src/backend/recaptcha.service.spec.ts
describe('RecaptchaService', () => {
  let service: RecaptchaService
  let configService: PluginConfigService
  
  beforeEach(async () => {
    // Setup
  })
  
  describe('verifyToken', () => {
    it('should return isBot=true if score below threshold', async () => {
      // Arrange
      const mockConfig = { secretKey: 'key', threshold: 0.5 }
      jest.spyOn(configService, 'getConfig').mockResolvedValue(mockConfig)
      
      // Act
      const result = await service.verifyToken(workspaceId, {
        token: 'token',
        action: 'login',
        score: 0.3  // Below threshold
      })
      
      // Assert
      expect(result.isBot).toBe(true)
    })
    
    it('should handle Google API errors gracefully', async () => {
      // Arrange
      jest.spyOn(axios, 'post').mockRejectedValue(new Error('API Error'))
      
      // Act
      const result = await service.verifyToken(workspaceId, {
        token: 'token',
        action: 'login'
      })
      
      // Assert
      expect(result.isValid).toBe(true)  // Don't block on error
      expect(result.isBot).toBe(false)
    })
  })
})
```

### Integration Tests

```typescript
// tests/plugins/recaptcha-integration.spec.ts
describe('reCAPTCHA Integration', () => {
  it('should block login if bot detected', async () => {
    // Arrange
    const token = 'invalid-token'
    
    // Act
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user@example.com',
        password: 'password',
        recaptchaToken: token
      })
    
    // Assert
    expect(response.status).toBe(403)
    expect(response.body.error).toContain('Bot detected')
  })
  
  it('should allow login if human detected', async () => {
    // Arrange
    const token = 'valid-token'  // Mock returns high score
    
    // Act
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user@example.com',
        password: 'password',
        recaptchaToken: token
      })
    
    // Assert
    expect(response.status).toBe(200)
    expect(response.body.token).toBeDefined()
  })
})
```

### E2E Tests

```typescript
// tests/plugins/recaptcha-e2e.spec.ts
describe('reCAPTCHA E2E', () => {
  it('should complete signup flow with reCAPTCHA', async () => {
    // Use playwright/cypress
    await page.goto('/auth/signup')
    
    // Fill form
    await page.fill('input[name=email]', 'newuser@example.com')
    await page.fill('input[name=password]', 'password')
    
    // Get reCAPTCHA token (mocked in test)
    const token = await page.evaluate(() => {
      return window.grecaptcha.execute(siteKey, { action: 'signup' })
    })
    
    // Submit form
    await page.click('button[type=submit]')
    
    // Should show success message
    await expect(page).toContainText('Account created')
  })
})
```

---

## Security Considerations

### 1. Secret Key Encryption

```typescript
// Encrypt secret keys before storing
async updateConfig(workspaceId, pluginId, config) {
  if (config.secretKey) {
    config.secretKey = await this.encryptionService.encrypt(
      config.secretKey,
      workspaceId  // Use workspace key
    )
  }
  // Store in database
}

// Decrypt before using
async getConfigForUse(workspaceId, pluginId) {
  const config = await this.getConfig(workspaceId, pluginId)
  if (config.secretKey) {
    config.secretKey = await this.encryptionService.decrypt(
      config.secretKey,
      workspaceId
    )
  }
  return config
}

// Never return secret in API response
async getConfigForFrontend(workspaceId, pluginId) {
  const config = await this.getConfig(workspaceId, pluginId)
  return {
    ...config,
    secretKey: undefined  // Never send to frontend
  }
}
```

### 2. Audit Logging

All plugin configuration changes are logged:

```typescript
// Log every config change
async updateConfig(workspaceId, pluginId, newConfig) {
  const oldConfig = await this.getConfig(workspaceId, pluginId)
  
  await db.pluginAuditLogs.create({
    workspaceId,
    pluginId,
    action: 'config_updated',
    oldConfig: this.redact(oldConfig),  // Redact secrets
    newConfig: this.redact(newConfig),  // Redact secrets
    performedBy: currentUser.id,
    createdAt: new Date()
  })
}

private redact(config) {
  const redacted = { ...config }
  if (redacted.secretKey) {
    redacted.secretKey = '***REDACTED***'
  }
  return redacted
}
```

### 3. Rate Limiting

```typescript
// Limit reCAPTCHA verify endpoint
@Post('verify')
@RateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100               // Max 100 per minute
})
async verifyToken(@Body() body: VerifyTokenRequest) {
  // ...
}
```

### 4. Bot Detection Logging

Track bot detection for monitoring:

```typescript
async logVerification(workspaceId, data) {
  await db.recaptchaVerifications.create({
    workspaceId,
    action: data.action,
    score: data.score,
    isBot: data.score < threshold,
    userIp: data.userIp,
    userAgent: data.userAgent,
    createdAt: new Date()
  })
}
```

---

## Monitoring & Observability

### Metrics to Track

1. **Verification Rate**: `verifications_per_minute`
2. **Bot Detection Rate**: `bots_detected_percentage`
3. **Average Score**: `avg_recaptcha_score`
4. **API Error Rate**: `recaptcha_api_errors_per_minute`
5. **Configuration Changes**: Audit log events

### Alerting

```yaml
# Example Prometheus alerts
- alert: HighBotDetectionRate
  expr: bots_detected_percentage > 10
  for: 5m
  annotations:
    summary: "Potential attack: {{$value}}% bot detection rate"

- alert: reCAPTCHAAPIErrors
  expr: recaptcha_api_errors_per_minute > 5
  for: 2m
  annotations:
    summary: "reCAPTCHA API errors detected"
```

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| **1. Plugin Infrastructure** | 2 weeks | PluginManager, API, DB schema |
| **2. reCAPTCHA PoC** | 2 weeks | Full integration, UI, hooks |
| **3. Monitoring & Polish** | 1 week | Stats, docs, security audit |
| **Total** | **5 weeks** | **Production-ready PoC** |

---

## Next Steps

1. ✅ Review this specification
2. ⏳ Set up git branches for implementation
3. ⏳ Create Phase 1 tasks in project tracking
4. ⏳ Begin Phase 1: Plugin Infrastructure

---

**End of Specification**

This document provides everything needed to implement the reCAPTCHA v3 plugin PoC with a full plugin management system. The architecture is designed to be extensible for future plugins while maintaining clean separation of concerns.
