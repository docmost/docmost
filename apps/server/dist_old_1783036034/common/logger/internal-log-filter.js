"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalLogFilter = void 0;
const common_1 = require("@nestjs/common");
class InternalLogFilter extends common_1.ConsoleLogger {
    constructor() {
        const isProduction = process.env.NODE_ENV === 'production';
        super({
            json: isProduction,
        });
        const isDebugMode = process.env.DEBUG_MODE === 'true';
        if (isProduction && !isDebugMode) {
            this.allowedLogLevels = ['info', 'error', 'fatal'];
        }
        else {
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
    isLogLevelAllowed(level) {
        return this.allowedLogLevels.includes(level);
    }
    log(_, context) {
        if (this.isLogLevelAllowed('info') &&
            !InternalLogFilter.contextsToIgnore.includes(context)) {
            super.log.apply(this, arguments);
        }
    }
    warn(_, context) {
        if (this.isLogLevelAllowed('warn')) {
            super.warn.apply(this, arguments);
        }
    }
    error(_, stack, context) {
        if (this.isLogLevelAllowed('error')) {
            super.error.apply(this, arguments);
        }
    }
    debug(_, context) {
        if (this.isLogLevelAllowed('debug')) {
            super.debug.apply(this, arguments);
        }
    }
    verbose(_, context) {
        if (this.isLogLevelAllowed('verbose')) {
            super.verbose.apply(this, arguments);
        }
    }
    printMessages(messages, context, logLevel, writeStreamType, errorStack) {
        const level = logLevel === 'log' ? 'info' : logLevel;
        super.printMessages(messages, context, level, writeStreamType, errorStack);
    }
}
exports.InternalLogFilter = InternalLogFilter;
InternalLogFilter.contextsToIgnore = [
    'NestFactory',
    'InstanceLoader',
    'RoutesResolver',
    'RouterExplorer',
    'WebSocketsController',
];
//# sourceMappingURL=internal-log-filter.js.map