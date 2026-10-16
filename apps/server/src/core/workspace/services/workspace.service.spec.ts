import { WorkspaceService } from './workspace.service';
import { UserRole } from '../../../common/helpers/types/permission';

const workspaceId = 'workspace-1';
const userId = 'user-1';
const authUser = { id: 'admin-1', role: UserRole.ADMIN } as any;

function buildService() {
  const trx = {
    deleteFrom: jest.fn(() => ({
      where: jest.fn(() => ({ execute: jest.fn() })),
    })),
  };
  const db = {
    transaction: () => ({ execute: (cb: (t: any) => any) => cb(trx) }),
  };
  const workspaceRepo = {
    findById: jest.fn().mockResolvedValue({ id: workspaceId }),
  };
  const userRepo = {
    findById: jest.fn().mockResolvedValue({
      id: userId,
      role: UserRole.MEMBER,
      deactivatedAt: null,
      deletedAt: null,
    }),
    updateUser: jest.fn(),
  };
  const repoDeletingByUser = () => ({
    deleteByUserAndWorkspace: jest.fn(),
  });
  const userSessionRepo = { revokeByUserId: jest.fn() };
  const integrationConnectionRepo = { deleteUserConnections: jest.fn() };

  const service = new WorkspaceService(
    workspaceRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    userRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    repoDeletingByUser() as any,
    repoDeletingByUser() as any,
    db as any,
    { add: jest.fn() } as any,
    {} as any,
    {} as any,
    { log: jest.fn() } as any,
    userSessionRepo as any,
    integrationConnectionRepo as any,
  );

  return { service, trx, integrationConnectionRepo };
}

describe('WorkspaceService user offboarding', () => {
  it('deletes personal integration connections on deactivation', async () => {
    const { service, trx, integrationConnectionRepo } = buildService();

    await service.deactivateUser(authUser, userId, workspaceId);

    expect(integrationConnectionRepo.deleteUserConnections).toHaveBeenCalledWith(
      userId,
      trx,
    );
  });

  it('deletes personal integration connections on deletion', async () => {
    const { service, trx, integrationConnectionRepo } = buildService();

    await service.deleteUser(authUser, userId, workspaceId);

    expect(integrationConnectionRepo.deleteUserConnections).toHaveBeenCalledWith(
      userId,
      trx,
    );
  });
});
