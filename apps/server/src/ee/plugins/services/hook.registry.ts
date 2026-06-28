import { Injectable, Logger } from '@nestjs/common'
import {
  HookRegistry as IHookRegistry,
  HookHandler,
  HookContext,
} from '../../../core/plugins/plugin-hooks'

@Injectable()
export class HookRegistry implements IHookRegistry {
  private readonly logger = new Logger(HookRegistry.name)
  private readonly handlers: Map<string, Set<HookHandler>> = new Map()

  on(event: string, handler: HookHandler): void {
    let handlers = this.handlers.get(event)
    if (!handlers) {
      handlers = new Set()
      this.handlers.set(event, handlers)
    }
    handlers.add(handler)
    this.logger.debug(
      `Hook handler registered for ${event} (${handlers.size} total)`,
    )
  }

  off(event: string, handler: HookHandler): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      const removed = handlers.delete(handler)
      if (removed) {
        this.logger.debug(`Hook handler removed from ${event}`)
      }
    }
  }

  async emit(event: string, context: HookContext): Promise<HookContext> {
    const handlers = this.handlers.get(event)
    if (!handlers || handlers.size === 0) {
      return context
    }

    let result = context
    const handlerArray = Array.from(handlers)

    for (const handler of handlerArray) {
      try {
        result = await handler(result)
      } catch (error: any) {
        // Critical errors should block
        if (
          error?.code === 'BOT_DETECTED' ||
          error?.code === 'UNAUTHORIZED' ||
          error?.code === 'FORBIDDEN'
        ) {
          throw error
        }

        // Non-critical errors should be logged but not block
        this.logger.warn(
          `Hook ${event} handler error (non-blocking): ${error?.message}`,
        )
      }
    }

    return result
  }

  getHandlerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0
  }

  getAllEventNames(): string[] {
    return Array.from(this.handlers.keys())
  }

  clear(): void {
    this.handlers.clear()
    this.logger.log('All hook handlers cleared')
  }
}
