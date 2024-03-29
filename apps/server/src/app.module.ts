import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { EnvironmentModule } from './integrations/environment/environment.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { WsModule } from './ws/ws.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { KyselyDbModule } from './kysely/kysely-db.module';
import * as fs from 'fs';

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
    KyselyDbModule,
    EnvironmentModule,
    CollaborationModule,
    WsModule,
    ...getServeStaticModule(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
