import { Module } from '@nestjs/common';
import { AttachmentService } from './services/attachment.service.js';
import { AttachmentController } from './attachment.controller.js';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import { UserModule } from '../user/user.module.js';
import { WorkspaceModule } from '../workspace/workspace.module.js';
import { AttachmentProcessor } from './processors/attachment.processor.js';
import { TokenModule } from '../auth/token.module.js';

@Module({
  imports: [StorageModule, UserModule, WorkspaceModule, TokenModule],
  controllers: [AttachmentController],
  providers: [AttachmentService, AttachmentProcessor],
})
export class AttachmentModule {}
