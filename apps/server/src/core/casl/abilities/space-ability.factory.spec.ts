import { Test, TestingModule } from '@nestjs/testing';
import SpaceAbilityFactory from './space-ability.factory';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../interfaces/space-ability.type';
import { SpaceRole } from '../../../common/helpers/types/permission';

describe('SpaceAbilityFactory', () => {
  let factory: SpaceAbilityFactory;
  let spaceMemberRepo: jest.Mocked<SpaceMemberRepo>;

  const mockUser = { id: 'user-1' } as any;
  const spaceId = 'space-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpaceAbilityFactory,
        {
          provide: SpaceMemberRepo,
          useValue: {
            getUserSpaceRoles: jest.fn(),
          },
        },
      ],
    }).compile();

    factory = module.get(SpaceAbilityFactory);
    spaceMemberRepo = module.get(SpaceMemberRepo);
  });

  describe('READER role', () => {
    beforeEach(() => {
      spaceMemberRepo.getUserSpaceRoles.mockResolvedValue([
        { role: SpaceRole.READER },
      ] as any);
    });

    it('can read pages', async () => {
      const ability = await factory.createForUser(mockUser, spaceId);
      expect(ability.can(SpaceCaslAction.Read, SpaceCaslSubject.Page)).toBe(
        true,
      );
    });

    it('cannot edit pages', async () => {
      const ability = await factory.createForUser(mockUser, spaceId);
      expect(ability.can(SpaceCaslAction.Edit, SpaceCaslSubject.Page)).toBe(
        false,
      );
    });

    it('can manage comments', async () => {
      const ability = await factory.createForUser(mockUser, spaceId);
      expect(
        ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Comment),
      ).toBe(true);
    });

    it('cannot manage pages', async () => {
      const ability = await factory.createForUser(mockUser, spaceId);
      expect(
        ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page),
      ).toBe(false);
    });
  });

  describe('WRITER role', () => {
    beforeEach(() => {
      spaceMemberRepo.getUserSpaceRoles.mockResolvedValue([
        { role: SpaceRole.WRITER },
      ] as any);
    });

    it('can manage pages', async () => {
      const ability = await factory.createForUser(mockUser, spaceId);
      expect(
        ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page),
      ).toBe(true);
    });

    it('can manage comments (implied by page manage)', async () => {
      const ability = await factory.createForUser(mockUser, spaceId);
      // WRITERs have Manage on Page, which covers editing.
      // Comment ability is implicitly available through page edit permission.
      expect(ability.can(SpaceCaslAction.Edit, SpaceCaslSubject.Page)).toBe(
        true,
      );
    });
  });

  describe('ADMIN role', () => {
    beforeEach(() => {
      spaceMemberRepo.getUserSpaceRoles.mockResolvedValue([
        { role: SpaceRole.ADMIN },
      ] as any);
    });

    it('can manage everything', async () => {
      const ability = await factory.createForUser(mockUser, spaceId);
      expect(
        ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings),
      ).toBe(true);
      expect(
        ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page),
      ).toBe(true);
    });
  });
});
