import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { SpaceRole } from '../../../common/helpers/types/permission';
import { User } from '@docmost/db/types/entity.types';
import { PageMemberRepo } from '@docmost/db/repos/page/page-memeber.repo';
import { findHighestUserPageRole } from '@docmost/db/repos/page/utils';
import {
  IPageAbility,
  PageCaslAction,
  PageCaslSubject,
} from '../interfaces/page-ability.type';

@Injectable()
export default class PageAbilityFactory {
  constructor(private readonly pageMemberRepo: PageMemberRepo) {}
  async createForUser(user: User, pageId: string) {
    const userPageRoles = await this.pageMemberRepo.getUserPageRoles(
      user.id,
      pageId,
    );

    const userPageRole = findHighestUserPageRole(userPageRoles);

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
  can(PageCaslAction.Manage, PageCaslSubject.Settings);
  can(PageCaslAction.Manage, PageCaslSubject.Member);
  can(PageCaslAction.Manage, PageCaslSubject.Page);
  return build();
}

function buildPageWriterAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IPageAbility>>(
    createMongoAbility,
  );
  can(PageCaslAction.Read, PageCaslSubject.Settings);
  can(PageCaslAction.Read, PageCaslSubject.Member);
  can(PageCaslAction.Manage, PageCaslSubject.Page);
  return build();
}

function buildPageReaderAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<IPageAbility>>(
    createMongoAbility,
  );
  can(PageCaslAction.Read, PageCaslSubject.Settings);
  can(PageCaslAction.Read, PageCaslSubject.Member);
  can(PageCaslAction.Read, PageCaslSubject.Page);
  return build();
}
