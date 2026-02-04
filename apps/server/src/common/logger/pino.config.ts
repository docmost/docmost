import { Params } from 'nestjs-pino';
import { stdTimeFunctions } from 'pino';

const CONTEXTS_TO_IGNORE = [
  'InstanceLoader',
  'RoutesResolver',
  'RouterExplorer',
  'LegacyRouteConverter',
  'WebSocketsController',
];

export function createPinoConfig(): Params {
  const isProduction = process.env.NODE_ENV?.toLowerCase() === 'production';
  const isDebugMode = process.env.DEBUG_MODE?.toLowerCase() === 'true';
  const logHttp = process.env.LOG_HTTP?.toLowerCase() === 'true';

  const level = isProduction && !isDebugMode ? 'info' : 'debug';

  return {
    pinoHttp: {
      level,
      timestamp: stdTimeFunctions.isoTime,
      transport: !isProduction
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
      formatters: {
        level: (label) => ({ level: label }),
      },
      hooks: {
        logMethod(inputArgs, method) {
          if (isProduction && !isDebugMode) {
            for (const arg of inputArgs) {
              if (typeof arg === 'object' && arg !== null && 'context' in arg) {
                const context = (arg as Record<string, unknown>)['context'];
                if (typeof context === 'string' && CONTEXTS_TO_IGNORE.includes(context)) {
                  return;
                }
              }
            }
          }
          return method.apply(this, inputArgs);
        },
      },
      serializers: {
        req: (req) => {
          const forwardedFor = req.headers?.['x-forwarded-for'];
          const ip =
            req.headers?.['cf-connecting-ip'] ||
            (typeof forwardedFor === 'string' ? forwardedFor.split(',')[0]?.trim() : undefined) ||
            req.remoteAddress;

          return {
            method: req.method,
            url: req.url,
            ip,
            userAgent: req.headers?.['user-agent'],
          };
        },
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      autoLogging: logHttp
        ? {
            ignore: (req) =>
              req.url === '/api/health' || req.url === '/api/health/live',
          }
        : false,
    },
  };
}
