import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  MongoAbility,
} from '@casl/ability';
import { Action } from '../ability.action';
import { UserRole } from '../../../helpers/types/permission';
import { User, Workspace } from '@docmost/db/types/entity.types';

export type Subjects =
  | 'Workspace'
  | 'WorkspaceInvitation'
  | 'Space'
  | 'SpaceMember'
  | 'Group'
  | 'GroupUser'
  | 'Attachment'
  | 'Comment'
  | 'Page'
  | 'User'
  | 'WorkspaceUser'
  | 'all';
export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export default class CaslAbilityFactory {
  createForUser(user: User, workspace: Workspace) {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    const userRole = user.role;

    if (userRole === UserRole.OWNER || userRole === UserRole.ADMIN) {
      // Workspace Users
      can([Action.Manage], 'Workspace');
      can([Action.Manage], 'WorkspaceUser');

      can([Action.Manage], 'WorkspaceInvitation');

      // Groups
      can([Action.Manage], 'Group');
      can([Action.Manage], 'GroupUser');

      // Attachments
      can([Action.Manage], 'Attachment');
    }

    if (userRole === UserRole.MEMBER) {
      can([Action.Read], 'WorkspaceUser');

      // Groups
      can([Action.Read], 'Group');
      can([Action.Read], 'GroupUser');

      // Attachments
      can([Action.Read, Action.Create], 'Attachment');
    }

    return build({
      detectSubjectType: (item) => item as ExtractSubjectType<Subjects>,
    });
  }
}
