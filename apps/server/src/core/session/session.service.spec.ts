import { SessionService } from './session.service';

function makeService(revoked: boolean) {
  const userSessionRepo = {
    revokeById: jest.fn(async () => revoked),
    revokeAllExceptCurrent: jest.fn(async () => undefined),
  };
  const wsService = {
    disconnectSession: jest.fn(),
    disconnectOtherSessions: jest.fn(),
  };
  const service = new SessionService(
    {} as any,
    userSessionRepo as any,
    {} as any,
    {} as any,
    wsService as any,
  );
  return { service, wsService };
}

describe('SessionService socket disconnects', () => {
  it('disconnects the sockets of a revoked session', async () => {
    const { service, wsService } = makeService(true);

    await service.revokeSession('session_1', 'user_1', 'ws_1');

    expect(wsService.disconnectSession).toHaveBeenCalledWith('session_1');
  });

  it('leaves sockets alone when nothing was revoked for this user', async () => {
    const { service, wsService } = makeService(false);

    await service.revokeSession('someone_elses_session', 'user_1', 'ws_1');

    expect(wsService.disconnectSession).not.toHaveBeenCalled();
  });

  it('disconnects every other session of the user on revoke-all', async () => {
    const { service, wsService } = makeService(true);

    await service.revokeAllOtherSessions('session_1', 'user_1', 'ws_1');

    expect(wsService.disconnectOtherSessions).toHaveBeenCalledWith(
      'user_1',
      'session_1',
    );
  });
});
