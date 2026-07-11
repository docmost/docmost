import { MongoAbility } from '@casl/ability';
import { User, Workspace } from "../../../database/types/entity.types";
import { IWorkspaceAbility } from '../interfaces/workspace-ability.type';
export default class WorkspaceAbilityFactory {
    createForUser(user: User, workspace: Workspace): MongoAbility<IWorkspaceAbility, import("@casl/ability").MongoQuery>;
}
