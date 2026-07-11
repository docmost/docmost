import { CanActivate } from '@nestjs/common';
import { WorkspaceRepo } from "../../../database/repos/workspace/workspace.repo";
import { EnvironmentService } from '../../../integrations/environment/environment.service';
export declare class SetupGuard implements CanActivate {
    private workspaceRepo;
    private environmentService;
    constructor(workspaceRepo: WorkspaceRepo, environmentService: EnvironmentService);
    canActivate(): Promise<boolean>;
}
