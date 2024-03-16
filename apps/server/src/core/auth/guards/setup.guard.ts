import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { WorkspaceRepository } from '../../workspace/repositories/workspace.repository';

@Injectable()
export class SetupGuard implements CanActivate {
  constructor(private workspaceRepository: WorkspaceRepository) {}
  async canActivate(): Promise<boolean> {
    const workspaceCount = await this.workspaceRepository.count();
    if (workspaceCount > 0) {
      throw new ForbiddenException('Workspace setup already completed.');
    }
    return true;
  }
}
