import { MongoAbility } from '@casl/ability';
import { User } from "../../../database/types/entity.types";
import { SpaceMemberRepo } from "../../../database/repos/space/space-member.repo";
import { ISpaceAbility } from '../interfaces/space-ability.type';
export default class SpaceAbilityFactory {
    private readonly spaceMemberRepo;
    constructor(spaceMemberRepo: SpaceMemberRepo);
    createForUser(user: User, spaceId: string): Promise<MongoAbility<ISpaceAbility, import("@casl/ability").MongoQuery>>;
}
