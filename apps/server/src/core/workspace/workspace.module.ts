import { Module } from '@nestjs/common';
import { WorkspaceService } from './services/workspace.service';
import { WorkspaceController } from './controllers/workspace.controller';
import { WorkspaceRepository } from './repositories/workspace.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { SpaceModule } from '../space/space.module';
import { WorkspaceInvitationService } from './services/workspace-invitation.service';
import { WorkspaceInvitationRepository } from './repositories/workspace-invitation.repository';
import { WorkspaceUserService } from './services/workspace-user.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, WorkspaceInvitation]),
    SpaceModule, UserModule
  ],
  controllers: [WorkspaceController],
  providers: [
    WorkspaceService,
    WorkspaceUserService,
    WorkspaceInvitationService,
    WorkspaceRepository,
    WorkspaceInvitationRepository,
  ],
  exports: [WorkspaceService, WorkspaceRepository],
})
export class WorkspaceModule {}
