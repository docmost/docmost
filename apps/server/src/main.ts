import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { TransformHttpResponseInterceptor } from './interceptors/http-response.interceptor';
import fastifyMultipart from '@fastify/multipart';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
    } as any),
  );

  app.setGlobalPrefix('api');

  await app.register(fastifyMultipart as any);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      stopAtFirstError: true,
    }),
  );
  app.enableCors();

  app.useGlobalInterceptors(new TransformHttpResponseInterceptor());
  app.enableShutdownHooks();

  await app.listen(process.env.PORT || 3000);
}

bootstrap();
