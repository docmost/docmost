/**
 * Hook system for plugins - minimal core interface
 * Core defines contracts only; EE implements and registers handlers
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
