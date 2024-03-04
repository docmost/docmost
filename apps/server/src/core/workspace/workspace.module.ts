import { Module } from '@nestjs/common';
import { WorkspaceService } from './services/workspace.service';
import { WorkspaceController } from './controllers/workspace.controller';
import { WorkspaceRepository } from './repositories/workspace.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceUser } from './entities/workspace-user.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { WorkspaceUserRepository } from './repositories/workspace-user.repository';
import { AuthModule } from '../auth/auth.module';
import { SpaceModule } from '../space/space.module';
import { WorkspaceUserService } from './services/workspace-user.service';
import { WorkspaceInvitationService } from './services/workspace-invitation.service';
import { WorkspaceInvitationRepository } from './repositories/workspace-invitation.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, WorkspaceUser, WorkspaceInvitation]),
    AuthModule,
    SpaceModule,
  ],
  controllers: [WorkspaceController],
  providers: [
    WorkspaceService,
    WorkspaceUserService,
    WorkspaceInvitationService,
    WorkspaceRepository,
    WorkspaceUserRepository,
    WorkspaceInvitationRepository,
  ],
  exports: [WorkspaceService, WorkspaceRepository, WorkspaceUserRepository],
})
export class WorkspaceModule {}
