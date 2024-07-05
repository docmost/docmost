import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { AppRequest } from '../helpers/types/request';

@Injectable()
export class DomainMiddleware implements NestMiddleware {
  constructor(
    private workspaceRepo: WorkspaceRepo,
    private environmentService: EnvironmentService,
  ) {}
  async use(
    req: AppRequest['raw'],
    _res: FastifyReply['raw'],
    next: () => void,
  ) {
    if (this.environmentService.isSelfHosted()) {
      const workspace = await this.workspaceRepo.findFirst();

      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }

      req.workspaceId = workspace.id;
      req.workspace = workspace;
    } else if (this.environmentService.isCloud()) {
      const header = req.headers.host;
      const subdomain = header.split('.')[0];

      const workspace = await this.workspaceRepo.findByHostname(subdomain);

      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }

      req.workspaceId = workspace.id;
      req.workspace = workspace;
    }

    next();
  }
}
