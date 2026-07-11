import { Page, User } from "../../../database/types/entity.types";
import { PagePermissionRepo } from "../../../database/repos/page/page-permission.repo";
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import { SpaceRepo } from "../../../database/repos/space/space.repo";
export declare class PageAccessService {
    private readonly pagePermissionRepo;
    private readonly spaceAbility;
    private readonly spaceRepo;
    constructor(pagePermissionRepo: PagePermissionRepo, spaceAbility: SpaceAbilityFactory, spaceRepo: SpaceRepo);
    validateCanView(page: Page, user: User): Promise<void>;
    validateCanViewWithPermissions(page: Page, user: User): Promise<{
        canEdit: boolean;
        hasRestriction: boolean;
    }>;
    validateCanEdit(page: Page, user: User): Promise<{
        hasRestriction: boolean;
    }>;
    validateCanComment(page: Page, user: User, workspaceId: string): Promise<void>;
}
