import { Module } from '@nestjs/common';
import { WorkspaceService } from './services/workspace.service';
import { WorkspaceController } from './controllers/workspace.controller';
import { SpaceModule } from '../space/space.module';
import { WorkspaceInvitationService } from './services/workspace-invitation.service';
import { WorkspaceUserService } from './services/workspace-user.service';
import { UserModule } from '../user/user.module';
import { GroupModule } from '../group/group.module';

@Module({
  imports: [SpaceModule, UserModule, GroupModule],
  controllers: [WorkspaceController],
  providers: [
    WorkspaceService,
    WorkspaceUserService,
    WorkspaceInvitationService,
  ],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
