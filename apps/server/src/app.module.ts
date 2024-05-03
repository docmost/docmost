import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { EnvironmentModule } from './integrations/environment/environment.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { WsModule } from './ws/ws.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DatabaseModule } from '@docmost/db/database.module';
import * as fs from 'fs';
import { StorageModule } from './integrations/storage/storage.module';
import { MailModule } from './integrations/mail/mail.module';
import { QueueModule } from './integrations/queue/queue.module';

const clientDistPath = join(__dirname, '..', '..', 'client/dist');

function getServeStaticModule() {
  if (fs.existsSync(clientDistPath)) {
    return [
      ServeStaticModule.forRoot({
        rootPath: clientDistPath,
      }),
    ];
  }
  return [];
}

@Module({
  imports: [
    CoreModule,
    DatabaseModule,
    EnvironmentModule,
    CollaborationModule,
    WsModule,
    QueueModule,
    ...getServeStaticModule(),
    StorageModule.forRootAsync({
      imports: [EnvironmentModule],
    }),
    MailModule.forRootAsync({
      imports: [EnvironmentModule],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
