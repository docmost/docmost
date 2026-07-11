import { NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { WorkspaceRepo } from "../../database/repos/workspace/workspace.repo";
export declare class DomainMiddleware implements NestMiddleware {
    private workspaceRepo;
    private environmentService;
    constructor(workspaceRepo: WorkspaceRepo, environmentService: EnvironmentService);
    use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void): Promise<void>;
}
