import { ShareService } from './share.service';
import { FastifyReply, FastifyRequest } from 'fastify';
import { WorkspaceRepo } from "../../database/repos/workspace/workspace.repo";
import { EnvironmentService } from '../../integrations/environment/environment.service';
export declare class ShareSeoController {
    private readonly shareService;
    private workspaceRepo;
    private environmentService;
    constructor(shareService: ShareService, workspaceRepo: WorkspaceRepo, environmentService: EnvironmentService);
    getShare(res: FastifyReply, req: FastifyRequest, shareId: string, pageSlug: string): Promise<void>;
    sendIndex(indexFilePath: string, res: FastifyReply): void;
    extractPageSlugId(slug: string): string;
}
