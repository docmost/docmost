import { ExportService } from './export.service';
import { ExportPageDto, ExportSpaceDto } from './dto/export-dto';
import { User } from "../../database/types/entity.types";
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import { PageRepo } from "../../database/repos/page/page.repo";
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { FastifyReply } from 'fastify';
import { IAuditService } from '../../integrations/audit/audit.service';
export declare class ExportController {
    private readonly exportService;
    private readonly pageRepo;
    private readonly spaceAbility;
    private readonly pageAccessService;
    private readonly auditService;
    constructor(exportService: ExportService, pageRepo: PageRepo, spaceAbility: SpaceAbilityFactory, pageAccessService: PageAccessService, auditService: IAuditService);
    exportPage(dto: ExportPageDto, user: User, res: FastifyReply): Promise<void>;
    exportSpace(dto: ExportSpaceDto, user: User, res: FastifyReply): Promise<void>;
}
