import { Module } from '@nestjs/common';
import { CommentService } from './comment.service.js';
import { CommentController } from './comment.controller.js';
import { CollaborationModule } from '../../collaboration/collaboration.module.js';

@Module({
  imports: [CollaborationModule],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
