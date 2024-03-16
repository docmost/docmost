import { Module } from '@nestjs/common';
import { AttachmentService } from './attachment.service';
import { AttachmentController } from './attachment.controller';
import { StorageModule } from '../../integrations/storage/storage.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment } from './entities/attachment.entity';
import { AttachmentRepository } from './repositories/attachment.repository';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attachment]),
    StorageModule,
    UserModule,
    WorkspaceModule,
  ],
  controllers: [AttachmentController],
  providers: [AttachmentService, AttachmentRepository],
})
export class AttachmentModule {}
