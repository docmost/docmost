import { ConsoleLogger, LogLevel } from '@nestjs/common';
export declare class InternalLogFilter extends ConsoleLogger {
    static contextsToIgnore: string[];
    private allowedLogLevels;
    constructor();
    private isLogLevelAllowed;
    log(_: any, context?: string): void;
    warn(_: any, context?: string): void;
    error(_: any, stack?: string, context?: string): void;
    debug(_: any, context?: string): void;
    verbose(_: any, context?: string): void;
    protected printMessages(messages: unknown[], context?: string, logLevel?: LogLevel, writeStreamType?: 'stdout' | 'stderr', errorStack?: unknown): void;
}
