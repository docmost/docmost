import { NotFoundException } from '@nestjs/common';
import SpaceAbilityFactory from './space-ability.factory';
import { SpaceRole } from '../../../common/helpers/types/permission';
import { INTEGRATION_CALLER_KEY } from '../../../common/helpers/integration-caller';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../interfaces/space-ability.type';

function buildFactory(opts: { integration: boolean; archived: boolean }) {
  const spaceMemberRepo = {
    getUserSpaceRoles: jest
      .fn()
      .mockResolvedValue([{ userId: 'user-1', role: SpaceRole.ADMIN }]),
  };
  const spaceRepo = { isArchived: jest.fn().mockResolvedValue(opts.archived) };
  const store = new Map<string, unknown>([
    [INTEGRATION_CALLER_KEY, opts.integration],
  ]);
  const cls = {
    isActive: () => true,
    get: (key: string) => store.get(key),
    set: (key: string, value: unknown) => store.set(key, value),
  };
  return {
    factory: new SpaceAbilityFactory(
      spaceMemberRepo as any,
      spaceRepo as any,
      cls as any,
    ),
    spaceMemberRepo,
    spaceRepo,
  };
}

describe('SpaceAbilityFactory archived spaces', () => {
  it('treats an archived space as missing for OAuth and MCP callers, even with a cached admin role', async () => {
    const { factory, spaceMemberRepo } = buildFactory({
      integration: true,
      archived: true,
    });
    await expect(
      factory.createForUser({ id: 'user-1' } as any, 'space-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(spaceMemberRepo.getUserSpaceRoles).not.toHaveBeenCalled();
  });

  it('lets app sessions and API keys into an archived space without an extra lookup', async () => {
    const { factory, spaceRepo } = buildFactory({
      integration: false,
      archived: true,
    });
    const ability = await factory.createForUser(
      { id: 'user-1' } as any,
      'space-1',
    );
    expect(ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)).toBe(
      true,
    );
    expect(spaceRepo.isArchived).not.toHaveBeenCalled();
  });

  it('looks an integration caller space up once per request', async () => {
    const { factory, spaceRepo } = buildFactory({
      integration: true,
      archived: false,
    });
    await factory.createForUser({ id: 'user-1' } as any, 'space-1');
    await factory.createForUser({ id: 'user-1' } as any, 'space-1');
    expect(spaceRepo.isArchived).toHaveBeenCalledTimes(1);
  });

  it('looks each space up separately', async () => {
    const { factory, spaceRepo } = buildFactory({
      integration: true,
      archived: false,
    });
    await factory.createForUser({ id: 'user-1' } as any, 'space-1');
    await factory.createForUser({ id: 'user-1' } as any, 'space-2');
    expect(spaceRepo.isArchived).toHaveBeenCalledTimes(2);
  });

  it('never looks up for callers that are not integrations', async () => {
    const { factory, spaceRepo } = buildFactory({
      integration: false,
      archived: true,
    });
    await factory.createForUser({ id: 'user-1' } as any, 'space-1');
    await factory.createForUser({ id: 'user-1' } as any, 'space-2');
    expect(spaceRepo.isArchived).not.toHaveBeenCalled();
  });

  it('lets OAuth and MCP callers into an active space', async () => {
    const { factory } = buildFactory({ integration: true, archived: false });
    const ability = await factory.createForUser(
      { id: 'user-1' } as any,
      'space-1',
    );
    expect(ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)).toBe(
      true,
    );
  });
});
