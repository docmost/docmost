import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { EnvironmentModule } from './environment/environment.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { DatabaseModule } from './database/database.module';
import { WsModule } from './ws/ws.module';

@Module({
  imports: [
    CoreModule,
    EnvironmentModule,
    DatabaseModule,
    CollaborationModule,
    WsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
