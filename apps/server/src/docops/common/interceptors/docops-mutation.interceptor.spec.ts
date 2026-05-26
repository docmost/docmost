import { of } from 'rxjs';
import { DocOpsMutationInterceptor } from './docops-mutation.interceptor';

const buildCtx = (method: string, url: string, body: any = {}, userId?: string) => ({
  switchToHttp: () => ({
    getRequest: () => ({
      method,
      url,
      body,
      ip: '10.0.0.1',
      headers: { 'user-agent': 'test' },
      user: userId ? { user: { id: userId } } : undefined,
    }),
  }),
});

const handler = (value: any = {}) => ({ handle: () => of(value) });

describe('DocOpsMutationInterceptor', () => {
  let interceptor: DocOpsMutationInterceptor;
  let auditLog: jest.Mock;

  beforeEach(() => {
    auditLog = jest.fn().mockResolvedValue(undefined);
    interceptor = new DocOpsMutationInterceptor({ log: auditLog } as any);
  });

  it('logs POST on /docops/ route', (done) => {
    const ctx = buildCtx('POST', '/api/docops/change-requests/transition', { id: 'cr-1' }, 'u1');
    interceptor.intercept(ctx as any, handler() as any).subscribe(() => {
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'u1', entityId: 'cr-1' }),
      );
      done();
    });
  });

  it('logs PATCH on /docops/ route', (done) => {
    const ctx = buildCtx('PATCH', '/api/docops/services/update', { id: 'svc-1' }, 'u2');
    interceptor.intercept(ctx as any, handler() as any).subscribe(() => {
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: 'svc-1' }),
      );
      done();
    });
  });

  it('logs DELETE on /docops/ route', (done) => {
    const ctx = buildCtx('DELETE', '/api/docops/webhooks/delete', { id: 'wh-1' });
    interceptor.intercept(ctx as any, handler() as any).subscribe(() => {
      expect(auditLog).toHaveBeenCalled();
      done();
    });
  });

  it('does NOT log for GET on /docops/ route', (done) => {
    const ctx = buildCtx('GET', '/api/docops/change-requests');
    interceptor.intercept(ctx as any, handler() as any).subscribe(() => {
      expect(auditLog).not.toHaveBeenCalled();
      done();
    });
  });

  it('does NOT log for POST on non-docops route', (done) => {
    const ctx = buildCtx('POST', '/api/auth/login', { email: 'x@x.it' });
    interceptor.intercept(ctx as any, handler() as any).subscribe(() => {
      expect(auditLog).not.toHaveBeenCalled();
      done();
    });
  });

  it('sanitizes password, secret, token from payloadDiff', (done) => {
    const ctx = buildCtx(
      'POST',
      '/api/docops/webhooks/create',
      { name: 'hook', secret: 'my-secret', token: 'tok', password: 'pass' },
      'admin-1',
    );
    interceptor.intercept(ctx as any, handler() as any).subscribe(() => {
      const diff = auditLog.mock.calls[0][0].payloadDiff;
      expect(diff).not.toHaveProperty('secret');
      expect(diff).not.toHaveProperty('token');
      expect(diff).not.toHaveProperty('password');
      expect(diff).toHaveProperty('name', 'hook');
      done();
    });
  });
});
