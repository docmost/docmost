import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

@Injectable()
export class SetupGuard implements CanActivate {
  constructor(
    private workspaceRepo: WorkspaceRepo,
    private environmentService: EnvironmentService,
  ) {}

  async canActivate(): Promise<boolean> {
    if (this.environmentService.isCloud()) {
      return false;
    }

    const workspaceCount = await this.workspaceRepo.count();
    if (workspaceCount > 0) {
      throw new ForbiddenException('Workspace setup already completed.');
    }
    return true;
  }
}
