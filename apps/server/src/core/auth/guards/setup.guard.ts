import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';

@Injectable()
export class SetupGuard implements CanActivate {
  constructor(private workspaceRepo: WorkspaceRepo) {}

  async canActivate(): Promise<boolean> {
    const workspaceCount = await this.workspaceRepo.count();
    if (workspaceCount > 0) {
      throw new ForbiddenException('Workspace setup already completed.');
    }
    return true;
  }
}
