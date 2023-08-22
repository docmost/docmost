import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { PageModule } from './page/page.module';

@Module({
  imports: [UserModule, AuthModule, WorkspaceModule, PageModule],
})
export class CoreModule {}
