import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BaseController } from './controllers/base.controller';
import { BasePropertyController } from './controllers/base-property.controller';
import { BaseRowController } from './controllers/base-row.controller';
import { BaseViewController } from './controllers/base-view.controller';
import { BaseService } from './services/base.service';
import { BasePropertyService } from './services/base-property.service';
import { BaseRowService } from './services/base-row.service';
import { BaseViewService } from './services/base-view.service';
import { BaseCsvExportService } from './services/base-csv-export.service';
import { BaseQueueProcessor } from './processors/base-queue.processor';
import { BaseWsService } from './realtime/base-ws.service';
import { BaseWsConsumers } from './realtime/base-ws-consumers';
import { BasePresenceService } from './realtime/base-presence.service';
import { QueueName } from '../../integrations/queue/constants';
import { BaseQueryCacheModule } from './query-cache/query-cache.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QueueName.BASE_QUEUE }),
    BaseQueryCacheModule,
  ],
  controllers: [
    BaseController,
    BasePropertyController,
    BaseRowController,
    BaseViewController,
  ],
  providers: [
    BaseService,
    BasePropertyService,
    BaseRowService,
    BaseViewService,
    BaseCsvExportService,
    BaseQueueProcessor,
    BasePresenceService,
    BaseWsService,
    BaseWsConsumers,
  ],
  exports: [
    BaseService,
    BasePropertyService,
    BaseRowService,
    BaseViewService,
    BaseWsService,
    BasePresenceService,
  ],
})
export class BaseModule {}
