import { Module } from '@nestjs/common';
import { AppController } from '../../app.controller';
import { AppService } from '../../app.service';
import { EnvironmentModule } from '../../integrations/environment/environment.module';
import { CollaborationModule } from '../collaboration.module';
import { DatabaseModule } from '@docmost/db/database.module';
import { QueueModule } from '../../integrations/queue/queue.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthModule } from '../../integrations/health/health.module';

@Module({
  imports: [
    DatabaseModule,
    EnvironmentModule,
    CollaborationModule,
    QueueModule,
    HealthModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class CollabAppAppModule {}
