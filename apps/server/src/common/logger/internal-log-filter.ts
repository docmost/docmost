import { ConsoleLogger, LogLevel } from '@nestjs/common';

export class InternalLogFilter extends ConsoleLogger {
  static contextsToIgnore = [
    'NestFactory',
    'InstanceLoader',
    'RoutesResolver',
    'RouterExplorer',
    'WebSocketsController',
  ];

  private allowedLogLevels: string[];

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    super({
      json: isProduction,
    });
    const isDebugMode = process.env.DEBUG_MODE === 'true';

    if (isProduction && !isDebugMode) {
      this.allowedLogLevels = ['info', 'error', 'fatal'];
    } else {
      this.allowedLogLevels = [
        'info',
        'debug',
        'verbose',
        'warn',
        'error',
        'fatal',
      ];
    }
  }

  private isLogLevelAllowed(level: string): boolean {
    return this.allowedLogLevels.includes(level);
  }

  log(_: any, context?: string): void {
    if (
      this.isLogLevelAllowed('info') &&
      !InternalLogFilter.contextsToIgnore.includes(context)
    ) {
      super.log.apply(this, arguments);
    }
  }

  warn(_: any, context?: string): void {
    if (this.isLogLevelAllowed('warn')) {
      super.warn.apply(this, arguments);
    }
  }

  error(_: any, stack?: string, context?: string): void {
    if (this.isLogLevelAllowed('error')) {
      super.error.apply(this, arguments);
    }
  }

  debug(_: any, context?: string): void {
    if (this.isLogLevelAllowed('debug')) {
      super.debug.apply(this, arguments);
    }
  }

  verbose(_: any, context?: string): void {
    if (this.isLogLevelAllowed('verbose')) {
      super.verbose.apply(this, arguments);
    }
  }

  protected printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
    writeStreamType?: 'stdout' | 'stderr',
    errorStack?: unknown,
  ): void {
    const level = logLevel === 'log' ? ('info' as LogLevel) : logLevel;
    super.printMessages(messages, context, level, writeStreamType, errorStack);
  }
}
