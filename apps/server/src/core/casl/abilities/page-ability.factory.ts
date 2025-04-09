import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { SpaceRole } from '../../../common/helpers/types/permission';
import { User } from '@docmost/db/types/entity.types';
import { PageMemberRepo } from '@docmost/db/repos/page/page-member.repo';
import { findHighestUserPageRole } from '@docmost/db/repos/page/utils';
import {
  IPageAbility,
  PageCaslAction,
  PageCaslSubject,
} from '../interfaces/page-ability.type';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { UserPageRole } from '@docmost/db/repos/page/types';

@Injectable()
export default class PageAbilityFactory {
  constructor(
    private readonly pageRepo: PageRepo,
    private readonly pageMemberRepo: PageMemberRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
  ) {}
  async createForUser(user: User, pageId: string) {
    const spaceId = (await this.pageRepo.findById(pageId)).spaceId;
    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      spaceId,
    );

    const userSpaceRole = findHighestUserPageRole(
      userSpaceRoles ? userSpaceRoles : [],
    );

    if (userSpaceRole == SpaceRole.ADMIN) {
      return buildPageAdminAbility();
    }

    const userPageRoles: UserPageRole[] =
      await this.pageMemberRepo.getUserPageRoles(user.id, pageId);

    const userPageRole = findHighestUserPageRole(
      userPageRoles ? userPageRoles : [],
    );

    switch (userPageRole) {
      case SpaceRole.ADMIN:
        return buildPageAdminAbility();
      case SpaceRole.WRITER:
        return buildPageWriterAbility();
      case SpaceRole.READER:
        return buildPageReaderAbility();
      default:
        throw new NotFoundException('Page permissions not found');
    }
  }
}

function buildPageAdminAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IPageAbility>>(
    createMongoAbility,
  );
  can(PageCaslAction.Manage, PageCaslSubject.Member);
  can(PageCaslAction.Manage, PageCaslSubject.Page);
  return build();
}

function buildPageWriterAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IPageAbility>>(
    createMongoAbility,
  );
  can(PageCaslAction.Read, PageCaslSubject.Member);
  can(PageCaslAction.Manage, PageCaslSubject.Page);
  return build();
}

function buildPageReaderAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IPageAbility>>(
    createMongoAbility,
  );
  can(PageCaslAction.Read, PageCaslSubject.Member);
  can(PageCaslAction.Read, PageCaslSubject.Page);
  return build();
}
