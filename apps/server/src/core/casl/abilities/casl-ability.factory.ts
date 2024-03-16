import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  InferSubjects,
  MongoAbility,
} from '@casl/ability';
import { User } from '../../user/entities/user.entity';
import { Action } from '../ability.action';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { WorkspaceInvitation } from '../../workspace/entities/workspace-invitation.entity';
import { UserRole } from '../../../helpers/types/permission';
import { Group } from '../../group/entities/group.entity';
import { GroupUser } from '../../group/entities/group-user.entity';
import { Attachment } from '../../attachment/entities/attachment.entity';
import { Space } from '../../space/entities/space.entity';
import { SpaceUser } from '../../space/entities/space-user.entity';
import { Page } from '../../page/entities/page.entity';
import { Comment } from '../../comment/entities/comment.entity';

export type Subjects =
  | InferSubjects<
      | typeof Workspace
      | typeof WorkspaceInvitation
      | typeof Space
      | typeof SpaceUser
      | typeof Group
      | typeof GroupUser
      | typeof Attachment
      | typeof Comment
      | typeof Page
      | typeof User
    >
  | 'workspaceUser'
  | 'all';
export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export default class CaslAbilityFactory {
  createForWorkspace(user: User, workspace: Workspace) {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    const userRole = user.role;

    if (userRole === UserRole.OWNER || userRole === UserRole.ADMIN) {
      // Workspace Users
      can<any>([Action.Manage], Workspace);
      can<any>([Action.Manage], 'workspaceUser');

      can<any>([Action.Manage], WorkspaceInvitation);

      // Groups
      can<any>([Action.Manage], Group);
      can<any>([Action.Manage], GroupUser);

      // Attachments
      can<any>([Action.Manage], Attachment);
    }

    if (userRole === UserRole.MEMBER) {
      // can<any>([Action.Read], WorkspaceUser);

      // Groups
      can<any>([Action.Read], Group);
      can<any>([Action.Read], GroupUser);

      // Attachments
      can<any>([Action.Read, Action.Create], Attachment);
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }

  createForUser(user: User) {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    can<any>([Action.Manage], User, { id: user.id });
    can<any>([Action.Read], User);

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
