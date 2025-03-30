import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { SpaceRole } from '../../../common/helpers/types/permission';
import { User } from '@docmost/db/types/entity.types';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import {
  SpaceCaslAction,
  ISpaceAbility,
  SpaceCaslSubject,
} from '../interfaces/space-ability.type';
import { findHighestUserSpaceRole } from '@docmost/db/repos/space/utils';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { anonymous } from 'src/common/helpers';

@Injectable()
export default class SpaceAbilityFactory {
  constructor(
    private readonly spaceRepo: SpaceRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo
  ) {}
  
  async createForUser(user: User, spaceId: string) {
    if (user === anonymous) {
      const space = await this.spaceRepo.findById(spaceId)
      if (space.isPublished) return buildSpaceReaderAbility();
      throw new UnauthorizedException();
    } else {
      const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
        user.id,
        spaceId,
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
  }
}

function buildSpaceAdminAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<ISpaceAbility>>(
    createMongoAbility,
  );
  can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings);
  can(SpaceCaslAction.Manage, SpaceCaslSubject.Member);
  can(SpaceCaslAction.Manage, SpaceCaslSubject.Page);
  return build();
}

function buildSpaceWriterAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<ISpaceAbility>>(
    createMongoAbility,
  );
  can(SpaceCaslAction.Read, SpaceCaslSubject.Settings);
  can(SpaceCaslAction.Read, SpaceCaslSubject.Member);
  can(SpaceCaslAction.Manage, SpaceCaslSubject.Page);
  return build();
}

function buildSpaceReaderAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<ISpaceAbility>>(
    createMongoAbility,
  );
  can(SpaceCaslAction.Read, SpaceCaslSubject.Settings);
  can(SpaceCaslAction.Read, SpaceCaslSubject.Member);
  can(SpaceCaslAction.Read, SpaceCaslSubject.Page);
  return build();
}
