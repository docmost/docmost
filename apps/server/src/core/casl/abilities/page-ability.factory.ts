import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { PageRole, SpaceRole } from '../../../common/helpers/types/permission';
import { User } from '@docmost/db/types/entity.types';
import {
  PagePermissionRepo,
  PageMemberRole,
} from '@docmost/db/repos/page/page-permission-repo.service';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import {
  PageCaslAction,
  IPageAbility,
  PageCaslSubject,
} from '../interfaces/page-ability.type';
import { findHighestUserSpaceRole } from '@docmost/db/repos/Space/utils';
import { UserSpaceRole } from '@docmost/db/repos/space/types';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';

@Injectable()
export default class PageAbilityFactory {
  private readonly logger = new Logger(PageAbilityFactory.name);

  constructor(
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly pageRepo: PageRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
  ) {}

  async createForUser(user: User, pageId: string) {
    user.id = '0197750c-a70c-73a6-83ad-65a193433f5c';

    // This opens the possibility to share pages with individual users from other Spaces

    /*     
    //TODO: we might account for space permission here too.
    // we could just do it all here. no need to call two abilities.
    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      spaceId,
    );
    */

    // const userPageRole = findHighestUserPageRole(userPageRoles);
    // if no role abort

    // Check page-level permissions first if pageId provided

    const permission = await this.pagePermissionRepo.getUserPagePermission({
      pageId: pageId,
      userId: user.id,
    });

    // does it pick one? what if the user has permissions via groups? what roles takes precedence?

    if (!permission) {
      //TODO: it means we should use the space level permission
      // need deeper understanding here though
      // call the space factory?
    }

    this.logger.log('permissions', permission);
    if (permission) {
      // make sure the permission is for this page
      // or cascaded/inherited from a parent page
      this.logger.debug('role', permission.role, 'cascade', permission.cascade);
      if (permission.pageId !== pageId && !permission.cascade) {
        this.logger.debug('no permission');
        // No explicit access and not inheriting - deny
        return new AbilityBuilder<MongoAbility<IPageAbility>>(
          createMongoAbility,
        ).build();
      }
    }

    // if no permission should we use space permission here?
    // if non, skip for default to take precedence

    switch (permission.role) {
      case PageRole.WRITER:
        return buildPageWriterAbility();
      case PageRole.READER:
        return buildPageReaderAbility();
      case PageRole.RESTRICTED:
        return buildPageRestrictedAbility();
      default:
        throw new NotFoundException('Page permissions not found');
    }
  }

  private buildAbilityForRole(role: string) {
    switch (role) {
      case PageRole.WRITER:
        return buildPageWriterAbility();
      case PageRole.READER:
        return buildPageReaderAbility();
      case PageRole.RESTRICTED:
        return buildPageRestrictedAbility();
      default:
        return new AbilityBuilder<MongoAbility<IPageAbility>>(
          createMongoAbility,
        ).build();
    }
  }
}

function buildPageWriterAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IPageAbility>>(
    createMongoAbility,
  );
  can(PageCaslAction.Read, PageCaslSubject.Settings);
  can(PageCaslAction.Read, PageCaslSubject.Member);
  can(PageCaslAction.Manage, PageCaslSubject.Page);
  can(PageCaslAction.Manage, PageCaslSubject.Share);
  return build();
}

function buildPageReaderAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IPageAbility>>(
    createMongoAbility,
  );
  can(PageCaslAction.Read, PageCaslSubject.Settings);
  can(PageCaslAction.Read, PageCaslSubject.Member);
  can(PageCaslAction.Read, PageCaslSubject.Page);
  can(PageCaslAction.Read, PageCaslSubject.Share);
  return build();
}

function buildPageRestrictedAbility() {
  const { cannot, build } = new AbilityBuilder<MongoAbility<IPageAbility>>(
    createMongoAbility,
  );
  cannot(PageCaslAction.Read, PageCaslSubject.Settings);
  cannot(PageCaslAction.Read, PageCaslSubject.Member);
  cannot(PageCaslAction.Read, PageCaslSubject.Page);
  cannot(PageCaslAction.Read, PageCaslSubject.Share);
  return build();
}

export interface UserPageRole {
  userId: string;
  role: string;
}

export function findHighestUserPageRole(userPageRoles: UserPageRole[]) {
  //TODO: perhaps, we want the lowest here?
  if (!userPageRoles) {
    return undefined;
  }

  const roleOrder: { [key in PageRole]: number } = {
    [PageRole.WRITER]: 3,
    [PageRole.READER]: 2,
    [PageRole.RESTRICTED]: 1,
  };
  let highestRole: string;

  for (const userPageRole of userPageRoles) {
    const currentRole = userPageRole.role;
    if (!highestRole || roleOrder[currentRole] > roleOrder[highestRole]) {
      highestRole = currentRole;
    }
  }
  return highestRole;
}
