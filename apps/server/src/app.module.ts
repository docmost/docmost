import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { EnvironmentService } from './integrations/environment/environment.service.js';
import { AuditActorInterceptor } from './common/interceptors/audit-actor.interceptor.js';
import { CoreModule } from './core/core.module.js';
import { EnvironmentModule } from './integrations/environment/environment.module.js';
import { CollaborationModule } from './collaboration/collaboration.module.js';
import { CollabAccessModule } from './collaboration/collab-access.module.js';
import { WsModule } from './ws/ws.module.js';
import { DatabaseModule } from '@docmost/db/database.module.js';
import { StorageModule } from './integrations/storage/storage.module.js';
import { MailModule } from './integrations/mail/mail.module.js';
import { QueueModule } from './integrations/queue/queue.module.js';
import { StaticModule } from './integrations/static/static.module.js';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthModule } from './integrations/health/health.module.js';
import { ExportModule } from './integrations/export/export.module.js';
import { ImportModule } from './integrations/import/import.module.js';
import { SecurityModule } from './integrations/security/security.module.js';
import { TelemetryModule } from './integrations/telemetry/telemetry.module.js';
import { RedisModule } from '@nestjs-labs/nestjs-ioredis';
import { RedisConfigService } from './integrations/redis/redis-config.service.js';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis, { defaultReconnectStrategy } from '@keyv/redis';
import { parseRedisUrl } from './common/helpers/index.js';
import { LoggerModule } from './common/logger/logger.module.js';
import { ClsModule } from 'nestjs-cls';
import { NoopAuditModule } from './integrations/audit/audit.module.js';
import { ThrottleModule } from './integrations/throttle/throttle.module.js';
import { OutboundModule } from './integrations/outbound/outbound.module.js';
import { EncryptionModule } from './integrations/encryption/encryption.module.js';
import { importEe } from './common/helpers/ee-loader.js';

const enterpriseModules = [];
try {
  const { EeModule } = await importEe('ee.module');
  if (EeModule) {
    enterpriseModules.push(EeModule);
  }
} catch (err) {
  if (process.env.CLOUD === 'true') {
    console.warn('Failed to load enterprise modules. Exiting program.\n', err);
    process.exit(1);
  }
}

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    LoggerModule,
    ...(enterpriseModules.length > 0 ? [] : [NoopAuditModule]),
    CoreModule,
    DatabaseModule,
    EnvironmentModule,
    EncryptionModule,
    RedisModule.forRootAsync({
      useClass: RedisConfigService,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (environmentService: EnvironmentService) => {
        const redisUrl = environmentService.getRedisUrl();
        const { family, tls } = parseRedisUrl(redisUrl);

        return {
          ttl: 5 * 1000,
          stores: [
            new KeyvRedis({
              url: redisUrl,
              socket: {
                family,
                reconnectStrategy: defaultReconnectStrategy,
                ...tls,
              },
            }),
          ],
        };
      },
      inject: [EnvironmentService],
    }),
    CollaborationModule,
    CollabAccessModule,
    WsModule,
    QueueModule,
    StaticModule,
    HealthModule,
    ImportModule,
    ExportModule,
    StorageModule.forRootAsync({
      imports: [EnvironmentModule],
    }),
    MailModule.forRootAsync({
      imports: [EnvironmentModule],
    }),
    EventEmitterModule.forRoot(),
    SecurityModule,
    TelemetryModule,
    ThrottleModule,
    OutboundModule,
    ...enterpriseModules,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditActorInterceptor,
    },
  ],
})
export class AppModule {}
