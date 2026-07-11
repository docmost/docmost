"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const common_1 = require("@nestjs/common");
const nestjs_pino_1 = require("nestjs-pino");
const http_response_interceptor_1 = require("./common/interceptors/http-response.interceptor");
const ws_redis_adapter_1 = require("./ws/adapter/ws-redis.adapter");
const multipart_1 = require("@fastify/multipart");
const cookie_1 = require("@fastify/cookie");
const fastify_ip_1 = require("fastify-ip");
const internal_log_filter_1 = require("./common/logger/internal-log-filter");
const environment_service_1 = require("./integrations/environment/environment.service");
const helpers_1 = require("./common/helpers");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter({
        trustProxy: true,
        routerOptions: {
            maxParamLength: 1000,
            ignoreTrailingSlash: true,
            ignoreDuplicateSlashes: true,
        },
    }), {
        rawBody: true,
        logger: new internal_log_filter_1.InternalLogFilter(),
        bufferLogs: false,
    });
    app.useLogger(app.get(nestjs_pino_1.Logger));
    app.setGlobalPrefix('api', {
        exclude: ['robots.txt', 'share/:shareId/p/:pageSlug', 'mcp'],
    });
    const reflector = app.get(core_1.Reflector);
    const redisIoAdapter = new ws_redis_adapter_1.WsRedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
    await app.register(fastify_ip_1.default);
    await app.register(multipart_1.default);
    await app.register(cookie_1.default);
    const environmentService = app.get(environment_service_1.EnvironmentService);
    const frameHeader = (0, helpers_1.resolveFrameHeader)(environmentService.isIframeEmbedAllowed(), environmentService.getIframeAllowedOrigins());
    if (frameHeader) {
        const frameHeaderSkippedPrefixes = ['/api/files/', '/share/'];
        app
            .getHttpAdapter()
            .getInstance()
            .addHook('onSend', (req, reply, payload, done) => {
            if (frameHeaderSkippedPrefixes.some((p) => req.url.startsWith(p))) {
                return done(null, payload);
            }
            reply.header(frameHeader.name, frameHeader.value);
            done(null, payload);
        });
    }
    app
        .getHttpAdapter()
        .getInstance()
        .addHook('onRequest', (request, _reply, done) => {
        request.raw.ip = request.ip;
        done();
    });
    app
        .getHttpAdapter()
        .getInstance()
        .addContentTypeParser('application/scim+json', { parseAs: 'string' }, (_, body, done) => {
        try {
            const json = JSON.parse(body.toString());
            done(null, json);
        }
        catch (err) {
            done(err);
        }
    });
    app
        .getHttpAdapter()
        .getInstance()
        .decorateReply('setHeader', function (name, value) {
        this.header(name, value);
    })
        .decorateReply('end', function () {
        this.send('');
    })
        .addHook('preHandler', function (req, reply, done) {
        const excludedPaths = [
            '/api/auth/setup',
            '/api/health',
            '/api/billing/stripe/webhook',
            '/api/workspace/check-hostname',
            '/api/sso/google',
            '/api/workspace/create',
            '/api/workspace/joined',
            '/api/workspace/find-by-email',
        ];
        if (req.originalUrl.startsWith('/api') &&
            !excludedPaths.some((path) => req.originalUrl.startsWith(path))) {
            if (!req.raw?.['workspaceId'] && req.originalUrl !== '/api') {
                throw new common_1.NotFoundException('Workspace not found');
            }
            done();
        }
        else {
            done();
        }
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        stopAtFirstError: true,
        transform: true,
    }));
    app.enableCors();
    app.useGlobalInterceptors(new http_response_interceptor_1.TransformHttpResponseInterceptor(reflector));
    app.enableShutdownHooks();
    const logger = new common_1.Logger('NestApplication');
    process.on('unhandledRejection', (reason, promise) => {
        logger.error(`UnhandledRejection, reason: ${reason}`, promise);
    });
    process.on('uncaughtException', (error) => {
        logger.error('UncaughtException:', error);
    });
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    await app.listen(port, host, () => {
        logger.log(`Listening on http://127.0.0.1:${port} / ${process.env.APP_URL}`);
    });
}
bootstrap();
//# sourceMappingURL=main.js.map