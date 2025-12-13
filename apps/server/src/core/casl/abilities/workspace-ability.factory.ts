import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { UserRole } from '../../../common/helpers/types/permission';
import { User, Workspace } from '@docmost/db/types/entity.types';
import {
  IWorkspaceAbility,
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../interfaces/workspace-ability.type';

@Injectable()
export default class WorkspaceAbilityFactory {
  createForUser(user: User, workspace: Workspace) {
    const userRole = user.role;

    switch (userRole) {
      case UserRole.OWNER:
        return buildWorkspaceOwnerAbility();
      case UserRole.ADMIN:
        return buildWorkspaceAdminAbility();
      case UserRole.MEMBER:
        return buildWorkspaceMemberAbility();
      default:
        throw new NotFoundException('Workspace permissions not found');
    }
  }
}

function buildWorkspaceOwnerAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IWorkspaceAbility>>(
    createMongoAbility,
  );
  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings);
  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Member);
  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Space);
  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Group);
  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Member);
  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Attachment);
  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.API);

  return build();
}

function buildWorkspaceAdminAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IWorkspaceAbility>>(
    createMongoAbility,
  );

  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings);
  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Member);
  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Space);
  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Group);
  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Member);
  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Attachment);
  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.API);

  return build();
}

function buildWorkspaceMemberAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IWorkspaceAbility>>(
    createMongoAbility,
  );
  can(WorkspaceCaslAction.Read, WorkspaceCaslSubject.Settings);
  can(WorkspaceCaslAction.Read, WorkspaceCaslSubject.Member);
  can(WorkspaceCaslAction.Read, WorkspaceCaslSubject.Space);
  can(WorkspaceCaslAction.Read, WorkspaceCaslSubject.Group);
  can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Attachment);
  can(WorkspaceCaslAction.Create, WorkspaceCaslSubject.API);

  return build();
}
