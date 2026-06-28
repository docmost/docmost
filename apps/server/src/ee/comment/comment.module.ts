import { Module } from '@nestjs/common';
import { CommentResolveService } from './comment-resolve.service';
import { CommentResolveController } from './comment-resolve.controller';
import { CollaborationModule } from '../../collaboration/collaboration.module';
import { PageAccessModule } from '../../core/page/page-access/page-access.module';

@Module({
  imports: [CollaborationModule, PageAccessModule],
  providers: [CommentResolveService],
  controllers: [CommentResolveController],
})
export class CommentEeModule {}
