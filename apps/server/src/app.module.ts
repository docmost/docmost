import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { EnvironmentModule } from './environment/environment.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { DatabaseModule } from './database/database.module';
import { WsModule } from './ws/ws.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    CoreModule,
    EnvironmentModule,
    DatabaseModule,
    CollaborationModule,
    WsModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', '..', 'client/dist'),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
