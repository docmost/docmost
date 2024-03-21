import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { WorkspaceRepository } from '../core/workspace/repositories/workspace.repository';
import { EnvironmentService } from '../integrations/environment/environment.service';

@Injectable()
export class DomainMiddleware implements NestMiddleware {
  constructor(
    private workspaceRepository: WorkspaceRepository,
    private environmentService: EnvironmentService,
  ) {}
  async use(
    req: FastifyRequest['raw'],
    res: FastifyReply['raw'],
    next: () => void,
  ) {
    if (this.environmentService.isSelfHosted()) {
      const workspace = await this.workspaceRepository.findFirst();
      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }

      (req as any).workspaceId = workspace.id;
    } else if (this.environmentService.isCloud()) {
      const header = req.headers.host;
      const subdomain = header.split('.')[0];

      const workspace = await this.workspaceRepository.findOneBy({
        hostname: subdomain,
      });

      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }

      (req as any).workspaceId = workspace.id;
    }

    next();
  }
}
