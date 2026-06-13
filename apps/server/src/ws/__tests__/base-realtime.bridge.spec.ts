import { BaseRealtimeBridge } from '../base-realtime.bridge';

function makeBridge(svc: any) {
  const moduleRef = { get: jest.fn().mockReturnValue(svc) } as any;
  const bridge = new BaseRealtimeBridge(moduleRef);
  // bypass the require() of the EE module for unit testing by forcing a resolved class token
  (bridge as any).loadServiceClass = () => (svc ? class {} : null);
  return { bridge, moduleRef };
}

describe('BaseRealtimeBridge', () => {
  it('delegates isBaseEvent / handleInbound to the resolved service', async () => {
    const svc = {
      isBaseEvent: jest.fn().mockReturnValue(true),
      handleInbound: jest.fn().mockResolvedValue(undefined),
    };
    const { bridge } = makeBridge(svc);
    expect(bridge.isBaseEvent({ t: 'base' })).toBe(true);
    await bridge.handleInbound({} as any, { t: 'base' });
    expect(svc.handleInbound).toHaveBeenCalled();
  });

  it('no-ops safely when the EE base module is absent', async () => {
    const { bridge } = makeBridge(null);
    expect(bridge.isBaseEvent({ t: 'base' })).toBe(false);
    await expect(bridge.handleDisconnect({} as any)).resolves.toBeUndefined();
    expect(() => bridge.setServer({} as any)).not.toThrow();
  });
});
