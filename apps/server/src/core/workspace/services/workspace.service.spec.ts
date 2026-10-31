import { WorkspaceService } from './workspace.service';
import { UserRole } from '../../../common/helpers/types/permission';

const workspaceId = 'workspace-1';
const userId = 'user-1';
const authUser = { id: 'admin-1', role: UserRole.ADMIN } as any;

function buildService() {
  const trx = {
    deleteFrom: vi.fn(() => ({
      where: vi.fn(() => ({ execute: vi.fn() })),
    })),
  };
  const db = {
    transaction: () => ({ execute: (cb: (t: any) => any) => cb(trx) }),
  };
  const workspaceRepo = {
    findById: vi.fn().mockResolvedValue({ id: workspaceId }),
  };
  const userRepo = {
    findById: vi.fn().mockResolvedValue({
      id: userId,
      role: UserRole.MEMBER,
      deactivatedAt: null,
      deletedAt: null,
    }),
    updateUser: vi.fn(),
  };
  const repoDeletingByUser = () => ({
    deleteByUserAndWorkspace: vi.fn(),
  });
  const userSessionRepo = { revokeByUserId: vi.fn() };
  const integrationConnectionRepo = { deleteUserConnections: vi.fn() };

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
    { add: vi.fn() } as any,
    {} as any,
    {} as any,
    { log: vi.fn() } as any,
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
