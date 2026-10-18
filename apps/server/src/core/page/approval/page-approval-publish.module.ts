import { Global, Module } from '@nestjs/common';
import { CollaborationModule } from '../../../collaboration/collaboration.module';
import { TransclusionModule } from '../transclusion/transclusion.module';
import { PageApprovalPublishService } from './page-approval-publish.service';

// Uses WsService, so only CoreModule imports it, never the collab app.
@Global()
@Module({
  imports: [CollaborationModule, TransclusionModule],
  providers: [PageApprovalPublishService],
  exports: [PageApprovalPublishService],
})
export class PageApprovalPublishModule {}
