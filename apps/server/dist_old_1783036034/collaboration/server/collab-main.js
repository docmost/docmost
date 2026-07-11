"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const collab_app_module_1 = require("./collab-app.module");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const http_response_interceptor_1 = require("../../common/interceptors/http-response.interceptor");
const common_1 = require("@nestjs/common");
const nestjs_pino_1 = require("nestjs-pino");
const internal_log_filter_1 = require("../../common/logger/internal-log-filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(collab_app_module_1.CollabAppModule, new platform_fastify_1.FastifyAdapter({
        routerOptions: {
            maxParamLength: 1000,
            ignoreTrailingSlash: true,
            ignoreDuplicateSlashes: true,
        },
    }), {
        logger: new internal_log_filter_1.InternalLogFilter(),
        bufferLogs: false,
    });
    app.useLogger(app.get(nestjs_pino_1.Logger));
    app.setGlobalPrefix('api', { exclude: ['/'] });
    app.enableCors();
    const reflector = app.get(core_1.Reflector);
    app.useGlobalInterceptors(new http_response_interceptor_1.TransformHttpResponseInterceptor(reflector));
    app.enableShutdownHooks();
    const logger = new common_1.Logger('CollabServer');
    const port = process.env.COLLAB_PORT || 3001;
    const host = process.env.HOST || '0.0.0.0';
    await app.listen(port, host, () => {
        logger.log(`Listening on http://127.0.0.1:${port}`);
    });
}
bootstrap();
//# sourceMappingURL=collab-main.js.map