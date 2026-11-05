import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { ClsService } from 'nestjs-cls';
import { SpaceRole } from '../../../common/helpers/types/permission';
import { User } from '@docmost/db/types/entity.types';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import {
  SpaceCaslAction,
  ISpaceAbility,
  SpaceCaslSubject,
} from '../interfaces/space-ability.type';
import { findHighestUserSpaceRole } from '@docmost/db/repos/space/utils';
import { CacheOptions } from '../../../common/helpers/with-cache';
import {
  ARCHIVED_SPACE_LOOKUPS_KEY,
  isIntegrationCaller,
} from '../../../common/helpers/integration-caller';

@Injectable()
export default class SpaceAbilityFactory {
  constructor(
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly spaceRepo: SpaceRepo,
    private readonly cls: ClsService,
  ) {}
  async createForUser(user: User, spaceId: string, opts?: CacheOptions) {
    if (isIntegrationCaller(this.cls) && (await this.isArchived(spaceId))) {
      throw new NotFoundException('Space permissions not found');
    }

    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      spaceId,
      opts,
    );

    const userSpaceRole = findHighestUserSpaceRole(userSpaceRoles);

    switch (userSpaceRole) {
      case SpaceRole.ADMIN:
        return buildSpaceAdminAbility();
      case SpaceRole.WRITER:
        return buildSpaceWriterAbility();
      case SpaceRole.READER:
        return buildSpaceReaderAbility();
      default:
        throw new NotFoundException('Space permissions not found');
    }
  }

  private isArchived(spaceId: string): Promise<boolean> {
    let lookups =
      this.cls.get<Map<string, Promise<boolean>>>(ARCHIVED_SPACE_LOOKUPS_KEY);
    if (!lookups) {
      lookups = new Map();
      this.cls.set(ARCHIVED_SPACE_LOOKUPS_KEY, lookups);
    }
    let lookup = lookups.get(spaceId);
    if (!lookup) {
      lookup = this.spaceRepo.isArchived(spaceId);
      lookups.set(spaceId, lookup);
    }
    return lookup;
  }
}

function buildSpaceAdminAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<ISpaceAbility>>(
    createMongoAbility,
  );
  can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings);
  can(SpaceCaslAction.Manage, SpaceCaslSubject.Member);
  can(SpaceCaslAction.Manage, SpaceCaslSubject.Page);
  can(SpaceCaslAction.Manage, SpaceCaslSubject.Share);
  return build();
}

function buildSpaceWriterAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<ISpaceAbility>>(
    createMongoAbility,
  );
  can(SpaceCaslAction.Read, SpaceCaslSubject.Settings);
  can(SpaceCaslAction.Read, SpaceCaslSubject.Member);
  can(SpaceCaslAction.Manage, SpaceCaslSubject.Page);
  can(SpaceCaslAction.Manage, SpaceCaslSubject.Share);
  return build();
}

function buildSpaceReaderAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<ISpaceAbility>>(
    createMongoAbility,
  );
  can(SpaceCaslAction.Read, SpaceCaslSubject.Settings);
  can(SpaceCaslAction.Read, SpaceCaslSubject.Member);
  can(SpaceCaslAction.Read, SpaceCaslSubject.Page);
  can(SpaceCaslAction.Read, SpaceCaslSubject.Share);
  return build();
}
