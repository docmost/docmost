import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { PageModule } from './page/page.module';
import { StorageModule } from './storage/storage.module';
import { AttachmentModule } from './attachment/attachment.module';
import { EnvironmentModule } from '../environment/environment.module';
import { CommentModule } from './comment/comment.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    UserModule,
    AuthModule,
    WorkspaceModule,
    PageModule,
    StorageModule.forRootAsync({
      imports: [EnvironmentModule],
    }),
    AttachmentModule,
    CommentModule,
    SearchModule,
  ],
})
export class CoreModule {}
