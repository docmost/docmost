# Phase 1: Plugin Management System Implementation Plan

**Duration**: 2 weeks  
**Status**: Ready to implement  
**Scope**: Core plugin infrastructure (no reCAPTCHA yet)  
**Goal**: Foundation for plugin system with minimal core changes

---

## Overview

Phase 1 tập trung vào xây dựng **plugin management infrastructure** - cho phép admin bật/tắt, cấu hình plugin mà không cần thay đổi core code.

### Deliverables

✅ Plugin discovery & loading system  
✅ Plugin configuration management  
✅ Plugin management UI (settings page)  
✅ Database schema for plugins  
✅ API endpoints for plugin management  
✅ Hook system foundation  

---

## Week 1: Backend Infrastructure

### Day 1-2: Core Hook Interface & Database Schema

#### Task 1.1: Create Hook Interface (0 risk)

**File**: `apps/server/src/core/plugins/plugin-hooks.ts`

```typescript
/**
 * Hook system for plugins.
 * Core defines contracts; EE implements and registers handlers
 */

export enum CoreHooks {
  // Auth events
  BEFORE_LOGIN = 'auth:beforeLogin',
  AFTER_LOGIN = 'auth:afterLogin',
  BEFORE_SIGNUP = 'auth:beforeSignup',
  AFTER_SIGNUP = 'auth:afterSignup',
  
  // Page events
  BEFORE_PAGE_CREATE = 'page:beforeCreate',
  AFTER_PAGE_CREATE = 'page:afterCreate',
  BEFORE_PAGE_DELETE = 'page:beforeDelete',
  
  // Plugin lifecycle
  ON_PLUGIN_ENABLE = 'plugin:onEnable',
  ON_PLUGIN_DISABLE = 'plugin:onDisable',
}

export interface HookContext {
  [key: string]: any
}

export interface HookHandler {
  (context: HookContext): Promise<HookContext>
}

export interface HookRegistry {
  on(event: string, handler: HookHandler): void
  off(event: string, handler: HookHandler): void
  emit(event: string, context: HookContext): Promise<HookContext>
}

let hookRegistry: HookRegistry | null = null

export function getHookRegistry(): HookRegistry {
  if (!hookRegistry) {
    throw new Error('Hook registry not initialized')
  }
  return hookRegistry
}

export function setHookRegistry(registry: HookRegistry) {
  hookRegistry = registry
}
```

**Checklist**:
- [ ] Create file
- [ ] Define CoreHooks enum (7 events)
- [ ] Define HookRegistry interface
- [ ] Export getter/setter functions
- [ ] No implementation, just interfaces

#### Task 1.2: Create Database Migrations

**Migration 1**: `apps/server/src/ee/plugins/migrations/001_plugin_definitions.sql`

```sql
-- Plugin definitions (what's available)
CREATE TABLE plugin_definitions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(20) NOT NULL,
  description TEXT,
  author VARCHAR(255),
  config_schema JSONB,
  required_permissions TEXT[],
  hooks TEXT[],
  backend_entry VARCHAR(255),
  backend_migrations TEXT[],
  frontend_entry VARCHAR(255),
  frontend_assets TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX idx_plugin_definitions_id ON plugin_definitions(id);
```

**Migration 2**: `apps/server/src/ee/plugins/migrations/002_plugin_configurations.sql`

```sql
-- Plugin configuration per workspace
CREATE TABLE plugin_configurations (
  id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plugin_id VARCHAR(50) NOT NULL REFERENCES plugin_definitions(id),
  enabled BOOLEAN DEFAULT FALSE,
  config JSONB,
  config_encrypted_fields TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id) SET NULL,
  updated_by UUID REFERENCES users(id) SET NULL,
  version INT DEFAULT 1,
  
  UNIQUE(workspace_id, plugin_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE INDEX idx_plugin_configs_workspace ON plugin_configurations(workspace_id);
CREATE INDEX idx_plugin_configs_plugin ON plugin_configurations(plugin_id);
CREATE INDEX idx_plugin_configs_enabled ON plugin_configurations(workspace_id, enabled);
```

**Migration 3**: `apps/server/src/ee/plugins/migrations/003_plugin_audit_logs.sql`

```sql
-- Plugin configuration audit trail
CREATE TABLE plugin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plugin_id VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'enabled', 'disabled', 'config_updated'
  old_config JSONB,
  new_config JSONB,
  performed_by UUID REFERENCES users(id) SET NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE INDEX idx_plugin_audit_workspace ON plugin_audit_logs(workspace_id);
CREATE INDEX idx_plugin_audit_plugin ON plugin_audit_logs(plugin_id);
CREATE INDEX idx_plugin_audit_created ON plugin_audit_logs(created_at);
```

**Checklist**:
- [ ] Create 3 migration files
- [ ] Define table schemas
- [ ] Create indexes
- [ ] Verify foreign key relationships
- [ ] Test migrations run successfully

### Day 3-4: Plugin Registry & Manager

#### Task 1.3: Create Plugin Registry

**File**: `apps/server/src/ee/plugins/plugin.registry.ts`

```typescript
import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'

export interface PluginMetadata {
  id: string
  name: string
  version: string
  description: string
  author: string
  configSchema?: Record<string, any>
  requiredPermissions?: string[]
  hooks?: string[]
  backend?: {
    entry: string
    migrations: string[]
  }
  frontend?: {
    entry: string
    assets: string[]
  }
}

@Injectable()
export class PluginRegistry {
  private plugins: Map<string, PluginMetadata> = new Map()

  constructor() {
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
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
          this.plugins.set(config.id, config)
        } catch (error) {
          console.error(`Failed to load plugin ${entry}:`, error)
        }
      }
    }
  }

  getPlugin(id: string): PluginMetadata | undefined {
    return this.plugins.get(id)
  }

  getAllPlugins(): PluginMetadata[] {
    return Array.from(this.plugins.values())
  }

  hasPlugin(id: string): boolean {
    return this.plugins.has(id)
  }
}
```

**Checklist**:
- [ ] Create PluginRegistry service
- [ ] Implement plugin discovery
- [ ] Load plugin.config.json from plugins/ directory
- [ ] Cache plugins in memory
- [ ] Error handling for bad configs

#### Task 1.4: Create Plugin Manager

**File**: `apps/server/src/ee/plugins/plugin.manager.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { PluginRegistry, PluginMetadata } from './plugin.registry'
import { PluginConfigService } from './plugin-config/plugin-config.service'
import { HookRegistry } from './hook/hook.registry'

@Injectable()
export class PluginManager {
  private logger = new Logger(PluginManager.name)
  private loadedPlugins: Map<string, any> = new Map()

  constructor(
    private registry: PluginRegistry,
    private configService: PluginConfigService,
    private hooks: HookRegistry
  ) {}

  async initializePlugins() {
    const plugins = this.registry.getAllPlugins()

    for (const plugin of plugins) {
      try {
        await this.loadPlugin(plugin.id)
      } catch (error) {
        this.logger.error(`Failed to load plugin ${plugin.id}:`, error)
      }
    }
  }

  async loadPlugin(pluginId: string) {
    if (this.loadedPlugins.has(pluginId)) {
      return
    }

    const metadata = this.registry.getPlugin(pluginId)
    if (!metadata) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    try {
      // Dynamically import plugin
      const module = await import(metadata.backend.entry)
      this.loadedPlugins.set(pluginId, module)

      this.logger.log(`Plugin loaded: ${pluginId} v${metadata.version}`)
    } catch (error) {
      this.logger.error(`Failed to load plugin module ${pluginId}:`, error)
      throw error
    }
  }

  async unloadPlugin(pluginId: string) {
    this.loadedPlugins.delete(pluginId)
    this.logger.log(`Plugin unloaded: ${pluginId}`)
  }

  getLoadedPlugin(pluginId: string): any {
    return this.loadedPlugins.get(pluginId)
  }

  async isPluginEnabledForWorkspace(
    workspaceId: string,
    pluginId: string
  ): Promise<boolean> {
    const config = await this.configService.getConfig(workspaceId, pluginId)
    return config?.enabled || false
  }
}
```

**Checklist**:
- [ ] Create PluginManager service
- [ ] Implement plugin loading
- [ ] Dynamic import of plugin modules
- [ ] Track loaded plugins
- [ ] Handle plugin enable/disable state

### Day 5: Hook Registry Implementation

#### Task 1.5: Create Hook Registry

**File**: `apps/server/src/ee/plugins/hook/hook.registry.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { HookRegistry as IHookRegistry, HookHandler, HookContext } from '../../../core/plugins/plugin-hooks'

@Injectable()
export class HookRegistry implements IHookRegistry {
  private logger = new Logger(HookRegistry.name)
  private handlers: Map<string, HookHandler[]> = new Map()

  on(event: string, handler: HookHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, [])
    }
    this.handlers.get(event)!.push(handler)
    this.logger.debug(`Handler registered for event: ${event}`)
  }

  off(event: string, handler: HookHandler): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  async emit(event: string, context: HookContext): Promise<HookContext> {
    const handlers = this.handlers.get(event) || []

    if (handlers.length === 0) {
      return context
    }

    let result = context

    for (const handler of handlers) {
      try {
        result = await handler(result)
      } catch (error) {
        this.logger.error(`Hook handler error for ${event}:`, error)

        // Propagate specific critical errors
        if (error.code === 'BOT_DETECTED' || error.code === 'UNAUTHORIZED') {
          throw error
        }

        // Log but don't block on other errors
        this.logger.warn(`Hook error ignored for ${event}: ${error.message}`)
      }
    }

    return result
  }
}
```

**Checklist**:
- [ ] Create HookRegistry implementation
- [ ] Implement event handler registration
- [ ] Implement hook emission with error handling
- [ ] Non-blocking error handling (don't break auth flow)

---

## Week 2: API & Frontend

### Day 1-2: Plugin Configuration Service

#### Task 2.1: Create Plugin Config Service

**File**: `apps/server/src/ee/plugins/plugin-config/plugin-config.service.ts`

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PluginConfigRepository } from './plugin-config.repository'
import { PluginRegistry } from '../plugin.registry'
import { validateConfigAgainstSchema } from './config.validator'

@Injectable()
export class PluginConfigService {
  constructor(
    private repository: PluginConfigRepository,
    private registry: PluginRegistry
  ) {}

  async getConfig(workspaceId: string, pluginId: string) {
    const plugin = this.registry.getPlugin(pluginId)
    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} not found`)
    }

    let config = await this.repository.findByWorkspaceAndPlugin(
      workspaceId,
      pluginId
    )

    if (!config) {
      // Return default config
      config = {
        id: null,
        workspaceId,
        pluginId,
        enabled: false,
        config: {},
        version: 0
      }
    }

    return config
  }

  async updateConfig(
    workspaceId: string,
    pluginId: string,
    updates: {
      enabled?: boolean
      config?: Record<string, any>
    }
  ) {
    const plugin = this.registry.getPlugin(pluginId)
    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} not found`)
    }

    // Validate config against schema
    if (updates.config && plugin.configSchema) {
      const validation = validateConfigAgainstSchema(
        updates.config,
        plugin.configSchema
      )
      if (!validation.valid) {
        throw new BadRequestException({
          message: 'Invalid configuration',
          errors: validation.errors
        })
      }
    }

    // Get current config to create audit trail
    const current = await this.getConfig(workspaceId, pluginId)

    // Update config
    const updated = await this.repository.upsertConfig(
      workspaceId,
      pluginId,
      updates
    )

    // Log to audit trail
    await this.repository.logAuditEvent({
      workspaceId,
      pluginId,
      action: 'config_updated',
      oldConfig: this.redactSecrets(current.config || {}),
      newConfig: this.redactSecrets(updates.config || {}),
      performedBy: null // Set by controller
    })

    return updated
  }

  async togglePlugin(
    workspaceId: string,
    pluginId: string,
    enabled: boolean
  ) {
    return this.updateConfig(workspaceId, pluginId, { enabled })
  }

  private redactSecrets(config: Record<string, any>) {
    const redacted = { ...config }
    // Redact known secret fields
    if (redacted.secretKey) redacted.secretKey = '***REDACTED***'
    if (redacted.password) redacted.password = '***REDACTED***'
    if (redacted.apiKey) redacted.apiKey = '***REDACTED***'
    return redacted
  }
}
```

**Checklist**:
- [ ] Create PluginConfigService
- [ ] Implement config retrieval
- [ ] Implement config updates with validation
- [ ] Implement toggle enable/disable
- [ ] Implement config secret redaction
- [ ] Audit logging

#### Task 2.2: Create Plugin Config Repository

**File**: `apps/server/src/ee/plugins/plugin-config/plugin-config.repository.ts`

```typescript
import { Injectable } from '@nestjs/common'
import { Database } from '@docmost/db'

@Injectable()
export class PluginConfigRepository {
  constructor(private db: Database) {}

  async findByWorkspaceAndPlugin(workspaceId: string, pluginId: string) {
    return this.db
      .selectFrom('plugin_configurations')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .where('plugin_id', '=', pluginId)
      .executeTakeFirst()
  }

  async upsertConfig(
    workspaceId: string,
    pluginId: string,
    updates: {
      enabled?: boolean
      config?: Record<string, any>
    }
  ) {
    const existing = await this.findByWorkspaceAndPlugin(workspaceId, pluginId)

    if (existing) {
      return this.db
        .updateTable('plugin_configurations')
        .set({
          ...updates,
          updated_at: new Date(),
          version: existing.version + 1
        })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirst()
    } else {
      return this.db
        .insertInto('plugin_configurations')
        .values({
          workspace_id: workspaceId,
          plugin_id: pluginId,
          ...updates,
          version: 1
        })
        .returningAll()
        .executeTakeFirst()
    }
  }

  async listByWorkspace(workspaceId: string) {
    return this.db
      .selectFrom('plugin_configurations')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .execute()
  }

  async logAuditEvent(event: {
    workspaceId: string
    pluginId: string
    action: string
    oldConfig?: Record<string, any>
    newConfig?: Record<string, any>
    performedBy?: string
  }) {
    return this.db
      .insertInto('plugin_audit_logs')
      .values({
        workspace_id: event.workspaceId,
        plugin_id: event.pluginId,
        action: event.action,
        old_config: event.oldConfig,
        new_config: event.newConfig,
        performed_by: event.performedBy
      })
      .execute()
  }
}
```

**Checklist**:
- [ ] Create repository
- [ ] Implement query methods
- [ ] Implement upsert logic
- [ ] Implement audit logging

### Day 3: Plugin Module & Controller

#### Task 2.3: Create Plugin Module

**File**: `apps/server/src/ee/plugins/plugin.module.ts`

```typescript
import { Module, Global, OnModuleInit, INestApplication } from '@nestjs/common'
import { setHookRegistry } from '../../core/plugins/plugin-hooks'
import { PluginRegistry } from './plugin.registry'
import { PluginManager } from './plugin.manager'
import { HookRegistry } from './hook/hook.registry'
import { PluginConfigService } from './plugin-config/plugin-config.service'
import { PluginConfigRepository } from './plugin-config/plugin-config.repository'
import { PluginsController } from './plugins.controller'

@Global()
@Module({
  providers: [
    PluginRegistry,
    PluginManager,
    HookRegistry,
    PluginConfigService,
    PluginConfigRepository
  ],
  controllers: [PluginsController],
  exports: [HookRegistry, PluginManager, PluginRegistry]
})
export class PluginsModule implements OnModuleInit {
  constructor(
    private hookRegistry: HookRegistry,
    private pluginManager: PluginManager
  ) {}

  async onModuleInit() {
    // Initialize hook registry globally
    setHookRegistry(this.hookRegistry)

    // Initialize plugins
    await this.pluginManager.initializePlugins()
  }
}
```

**Checklist**:
- [ ] Create PluginModule
- [ ] Provide all services
- [ ] Initialize hook registry on module init
- [ ] Load plugins on startup

#### Task 2.4: Create Plugin Controller

**File**: `apps/server/src/ee/plugins/plugins.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  Query
} from '@nestjs/common'
import { RequireWorkspaceAdmin } from '../../core/auth/guards/require-workspace-admin.guard'
import { PluginRegistry } from './plugin.registry'
import { PluginManager } from './plugin.manager'
import { PluginConfigService } from './plugin-config/plugin-config.service'

@Controller('api/plugins')
export class PluginsController {
  constructor(
    private registry: PluginRegistry,
    private manager: PluginManager,
    private configService: PluginConfigService
  ) {}

  @Get()
  @UseGuards(RequireWorkspaceAdmin)
  async listPlugins(@Request() req: any, @Query() query: any) {
    const plugins = this.registry.getAllPlugins()

    // Enrich with workspace-specific config
    const enriched = await Promise.all(
      plugins.map(async (plugin) => {
        const config = await this.configService.getConfig(
          req.workspace.id,
          plugin.id
        )

        return {
          ...plugin,
          enabled: config?.enabled || false,
          configured: !!config?.id
        }
      })
    )

    return { plugins: enriched }
  }

  @Get(':pluginId')
  @UseGuards(RequireWorkspaceAdmin)
  async getPluginDetails(
    @Request() req: any,
    @Param('pluginId') pluginId: string
  ) {
    const plugin = this.registry.getPlugin(pluginId)
    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} not found`)
    }

    const config = await this.configService.getConfig(req.workspace.id, pluginId)

    return {
      ...plugin,
      enabled: config?.enabled || false,
      configured: !!config?.id,
      configStatus: this.getConfigStatus(plugin, config)
    }
  }

  @Get(':pluginId/config')
  @UseGuards(RequireWorkspaceAdmin)
  async getPluginConfig(@Request() req: any, @Param('pluginId') pluginId: string) {
    const config = await this.configService.getConfig(req.workspace.id, pluginId)
    return config
  }

  @Put(':pluginId/config')
  @UseGuards(RequireWorkspaceAdmin)
  async updatePluginConfig(
    @Request() req: any,
    @Param('pluginId') pluginId: string,
    @Body() body: any
  ) {
    const updated = await this.configService.updateConfig(
      req.workspace.id,
      pluginId,
      body
    )

    return updated
  }

  @Post(':pluginId/toggle')
  @UseGuards(RequireWorkspaceAdmin)
  async togglePlugin(
    @Request() req: any,
    @Param('pluginId') pluginId: string,
    @Body() body: { enabled: boolean }
  ) {
    await this.configService.togglePlugin(req.workspace.id, pluginId, body.enabled)

    return { success: true, enabled: body.enabled }
  }

  private getConfigStatus(plugin: any, config: any) {
    if (!config?.id) {
      return 'not_configured'
    }
    if (!config.enabled) {
      return 'disabled'
    }
    return 'enabled'
  }
}
```

**Checklist**:
- [ ] Create PluginsController
- [ ] Implement list plugins endpoint
- [ ] Implement get plugin details endpoint
- [ ] Implement get plugin config endpoint
- [ ] Implement update plugin config endpoint
- [ ] Implement toggle plugin endpoint
- [ ] Add workspace admin guard to all endpoints

### Day 4-5: Frontend UI

#### Task 2.5: Create Plugin Settings Page

**File**: `apps/client/src/ee/plugins/pages/plugin-settings.tsx`

```typescript
import { useState, useEffect } from 'react'
import { useWorkspace } from '@/features/workspace/hooks/use-workspace'
import { Button, Card, Tabs } from '@mantine/core'
import { PluginList } from '../components/plugin-list'
import { PluginConfigPanel } from '../components/plugin-config-panel'
import { usePlugins } from '../hooks/use-plugins'

export function PluginSettingsPage() {
  const { workspace } = useWorkspace()
  const { plugins, loading, error, refetch } = usePlugins(workspace?.id)
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Plugin Management</h1>
        <p className="text-gray-600">
          Manage and configure plugins for your workspace
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <PluginList
        plugins={plugins}
        loading={loading}
        onSelect={setSelectedPlugin}
        onToggle={() => refetch()}
      />

      {selectedPlugin && (
        <PluginConfigPanel
          pluginId={selectedPlugin}
          onClose={() => setSelectedPlugin(null)}
          onSave={() => refetch()}
        />
      )}
    </div>
  )
}
```

**Checklist**:
- [ ] Create plugin settings page
- [ ] Add to workspace settings routes
- [ ] Implement plugin list display
- [ ] Implement config panel modal

#### Task 2.6: Create Plugin Components

**File**: `apps/client/src/ee/plugins/components/plugin-list.tsx`

```typescript
import { useState } from 'react'
import { Card, Badge, Switch, Button, Menu } from '@mantine/core'
import { IconDots } from '@tabler/icons-react'

export function PluginList({
  plugins,
  loading,
  onSelect,
  onToggle
}: {
  plugins: any[]
  loading: boolean
  onSelect: (id: string) => void
  onToggle: () => void
}) {
  if (loading) {
    return <div>Loading plugins...</div>
  }

  if (plugins.length === 0) {
    return <div className="text-gray-500">No plugins available</div>
  }

  return (
    <div className="space-y-4">
      {plugins.map((plugin) => (
        <Card key={plugin.id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{plugin.name}</h3>
              <p className="text-sm text-gray-600 mb-2">{plugin.description}</p>
              <div className="flex gap-2">
                {plugin.enabled && (
                  <Badge color="green" size="sm">
                    Enabled
                  </Badge>
                )}
                {plugin.configured && (
                  <Badge color="blue" size="sm">
                    Configured
                  </Badge>
                )}
                {!plugin.configured && (
                  <Badge color="orange" size="sm">
                    Not Configured
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={plugin.enabled}
                onChange={(e) => handleToggle(plugin.id, e.currentTarget.checked)}
              />

              <Menu>
                <Menu.Target>
                  <Button variant="subtle" size="sm">
                    <IconDots size={16} />
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => onSelect(plugin.id)}>
                    Configure
                  </Menu.Item>
                  <Menu.Item>View Logs</Menu.Item>
                  <Menu.Item>Documentation</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function handleToggle(pluginId: string, enabled: boolean) {
  // Call API
  fetch(`/api/plugins/${pluginId}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  })
}
```

**Checklist**:
- [ ] Create plugin list component
- [ ] Display plugin information
- [ ] Implement toggle switch
- [ ] Implement configure button
- [ ] Handle toggle action

---

## Testing Checklist

### Unit Tests

- [ ] PluginRegistry: loads plugins from disk
- [ ] PluginManager: loads/unloads plugins
- [ ] HookRegistry: registers and emits hooks
- [ ] PluginConfigService: validates and updates config

### Integration Tests

- [ ] API endpoints return correct data
- [ ] Config updates persist to database
- [ ] Toggle enable/disable works
- [ ] Audit logs are recorded

### Manual Testing

- [ ] Navigate to plugin settings page
- [ ] See list of available plugins
- [ ] Toggle plugin on/off
- [ ] Click configure button
- [ ] Database tables have correct data

---

## Database Verification

After running migrations:

```sql
-- Verify tables exist
\dt plugin_*

-- Check if any plugins configured
SELECT * FROM plugin_configurations;

-- Check audit logs
SELECT * FROM plugin_audit_logs;
```

---

## Success Criteria

✅ Plugin system loads on startup  
✅ Admin can see list of available plugins  
✅ Admin can enable/disable plugins  
✅ Admin can navigate to plugin settings  
✅ Configuration changes are persisted  
✅ Audit trail recorded for all changes  
✅ No core code modified (except hook interface + calls)  
✅ Database schema in place  
✅ All tests passing  

---

## Deliverables Summary

| Component | File | Status |
|-----------|------|--------|
| Hook Interface | `apps/server/src/core/plugins/plugin-hooks.ts` | To implement |
| Hook Registry | `apps/server/src/ee/plugins/hook/hook.registry.ts` | To implement |
| Plugin Registry | `apps/server/src/ee/plugins/plugin.registry.ts` | To implement |
| Plugin Manager | `apps/server/src/ee/plugins/plugin.manager.ts` | To implement |
| Config Service | `apps/server/src/ee/plugins/plugin-config/plugin-config.service.ts` | To implement |
| Config Repository | `apps/server/src/ee/plugins/plugin-config/plugin-config.repository.ts` | To implement |
| Plugin Module | `apps/server/src/ee/plugins/plugin.module.ts` | To implement |
| Plugin Controller | `apps/server/src/ee/plugins/plugins.controller.ts` | To implement |
| Plugin Settings Page | `apps/client/src/ee/plugins/pages/plugin-settings.tsx` | To implement |
| Plugin List Component | `apps/client/src/ee/plugins/components/plugin-list.tsx` | To implement |
| Migrations | `apps/server/src/ee/plugins/migrations/*.sql` | To implement |
| Tests | `apps/server/src/ee/plugins/**/*.spec.ts` | To implement |

---

## Next Steps

1. ✅ Review this Phase 1 plan
2. ⏳ Start Day 1: Create hook interface
3. ⏳ Continue with backend infrastructure
4. ⏳ Build frontend UI
5. ⏳ Run comprehensive tests
6. ⏳ Verify fork upgrade safety

Total estimated duration: **2 weeks for Phase 1**
