import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { NotFoundException, ValidationPipe } from '@nestjs/common';
import { TransformHttpResponseInterceptor } from './interceptors/http-response.interceptor';
import fastifyMultipart from '@fastify/multipart';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
    }),
  );

  app.setGlobalPrefix('api');

  await app.register(fastifyMultipart);

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('preHandler', function (req, reply, done) {
      if (
        req.originalUrl.startsWith('/api') &&
        !req.originalUrl.startsWith('/api/auth/setup')
      ) {
        if (!req.raw?.['workspaceId']) {
          throw new NotFoundException('Workspace not found');
        }
        done();
      } else {
        done();
      }
    });

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

  await app.listen(process.env.PORT || 3000);
}

bootstrap();
