import { Module } from '@nestjs/common';
import { AttachmentService } from './attachment.service';

@Module({
  providers: [AttachmentService],
})
export class AttachmentModule {}
