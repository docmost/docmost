import { Module } from '@nestjs/common';
import { WorkspaceService } from './services/workspace.service.js';
import { WorkspaceController } from './controllers/workspace.controller.js';
import { SpaceModule } from '../space/space.module.js';
import { WorkspaceInvitationService } from './services/workspace-invitation.service.js';
import { TokenModule } from '../auth/token.module.js';
import { IntegrationModule } from '../integration/integration.module.js';

@Module({
  imports: [SpaceModule, TokenModule, IntegrationModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceInvitationService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
