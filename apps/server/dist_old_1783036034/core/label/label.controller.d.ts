import { LabelService } from './label.service';
import { FindPagesByLabelDto, ListLabelsDto } from './dto/label.dto';
import { User, Workspace } from "../../database/types/entity.types";
import { LabelRepo } from "../../database/repos/label/label.repo";
import { PaginationOptions } from "../../database/pagination/pagination-options";
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
export declare class LabelController {
    private readonly labelService;
    private readonly labelRepo;
    private readonly spaceAbility;
    constructor(labelService: LabelService, labelRepo: LabelRepo, spaceAbility: SpaceAbilityFactory);
    getLabels(dto: ListLabelsDto, pagination: PaginationOptions, user: User, workspace: Workspace): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        type: string;
        id: string;
        workspaceId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
    }, undefined>>;
    findPagesByLabel(dto: FindPagesByLabelDto, pagination: PaginationOptions, user: User, workspace: Workspace): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<unknown, undefined>>;
    private assertCanReadSpace;
}
