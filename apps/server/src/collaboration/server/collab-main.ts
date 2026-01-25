import { NestFactory, Reflector } from '@nestjs/core';
import { CollabAppModule } from './collab-app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { TransformHttpResponseInterceptor } from '../../common/interceptors/http-response.interceptor';
import { Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    CollabAppModule,
    new FastifyAdapter({
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
      maxParamLength: 500,
    }),
    {
      bufferLogs: true,
    },
  );

  app.useLogger(app.get(PinoLogger));

  app.setGlobalPrefix('api', { exclude: ['/'] });

  app.enableCors();

  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new TransformHttpResponseInterceptor(reflector));
  app.enableShutdownHooks();

  const logger = new Logger('CollabServer');

  const port = process.env.COLLAB_PORT || 3001;
  await app.listen(port, '0.0.0.0', () => {
    logger.log(`Listening on http://127.0.0.1:${port}`);
  });
}

bootstrap();
