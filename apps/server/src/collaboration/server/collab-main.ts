import { NestFactory } from '@nestjs/core';
import { CollabAppAppModule } from './collab-app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { TransformHttpResponseInterceptor } from '../../common/interceptors/http-response.interceptor';
import { InternalLogFilter } from '../../common/logger/internal-log-filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    CollabAppAppModule,
    new FastifyAdapter({
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
      maxParamLength: 500,
    }),
    {
      logger: new InternalLogFilter(),
    },
  );

  app.enableCors();

  app.useGlobalInterceptors(new TransformHttpResponseInterceptor());
  app.enableShutdownHooks();

  await app.listen(process.env.COLLAB_PORT || 3001, '0.0.0.0');
}

bootstrap();
