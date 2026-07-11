import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import { User, Workspace } from "../../database/types/entity.types";
import { ImportService } from './services/import.service';
import { EnvironmentService } from '../environment/environment.service';
import { IAuditService } from '../../integrations/audit/audit.service';
export declare class ImportController {
    private readonly importService;
    private readonly spaceAbility;
    private readonly environmentService;
    private readonly auditService;
    private readonly logger;
    constructor(importService: ImportService, spaceAbility: SpaceAbilityFactory, environmentService: EnvironmentService, auditService: IAuditService);
    importPage(req: any, user: User, workspace: Workspace): Promise<any>;
    importZip(req: any, user: User, workspace: Workspace): Promise<{
        type: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        metadata: import("../../database/types/db").JsonValue;
        status: string;
        spaceId: string;
        pageId: string;
        fileExt: string;
        fileName: string;
        filePath: string;
        fileSize: string;
        errorMessage: string;
        source: string;
    }>;
}
