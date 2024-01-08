import { Module } from '@nestjs/common';
import { AttachmentService } from './attachment.service';
import { AttachmentController } from './attachment.controller';
import { StorageModule } from '../storage/storage.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment } from './entities/attachment.entity';
import { AttachmentRepository } from './repositories/attachment.repository';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attachment]),
    StorageModule,
    AuthModule,
    UserModule,
    WorkspaceModule,
  ],
  controllers: [AttachmentController],
  providers: [AttachmentService, AttachmentRepository],
})
export class AttachmentModule {}
