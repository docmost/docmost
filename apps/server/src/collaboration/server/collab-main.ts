import { NestFactory } from '@nestjs/core';
import { CollabAppAppModule } from './collab-app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      stopAtFirstError: true,
      transform: true,
    }),
  );

  app.enableCors();

  app.useGlobalInterceptors(new TransformHttpResponseInterceptor());
  app.enableShutdownHooks();

  await app.listen(3001, '0.0.0.0');
}

bootstrap();
