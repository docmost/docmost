import { Module } from '@nestjs/common';
import { AttachmentService } from './services/attachment.service';
import { AttachmentController } from './attachment.controller';
import { StorageModule } from '../../integrations/storage/storage.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AttachmentProcessor } from './processors/attachment.processor';
import { TokenModule } from '../auth/token.module';

@Module({
  imports: [StorageModule, UserModule, WorkspaceModule, TokenModule],
  controllers: [AttachmentController],
  providers: [AttachmentService, AttachmentProcessor],
})
export class AttachmentModule {}
