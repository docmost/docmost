import { Module } from '@nestjs/common';
import { PagePermissionService } from './page-permission.service';
import { PagePermissionController } from './page-permission.controller';
import { PageAccessModule } from '../../core/page/page-access/page-access.module';
import { QueueModule } from '../../integrations/queue/queue.module';

@Module({
  imports: [PageAccessModule, QueueModule],
  providers: [PagePermissionService],
  controllers: [PagePermissionController],
})
export class PagePermissionModule {}
