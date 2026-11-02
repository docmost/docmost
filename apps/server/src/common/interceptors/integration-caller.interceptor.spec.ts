import { of } from 'rxjs';
import { IntegrationCallerInterceptor } from './integration-caller.interceptor';
import { INTEGRATION_CALLER_KEY } from '../helpers/integration-caller';

function intercept(authType: string) {
  const cls = { isActive: () => true, set: jest.fn() };
  const interceptor = new IntegrationCallerInterceptor(cls as any);
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ user: { authType } }) }),
  };
  const next = { handle: () => of(null) };
  interceptor.intercept(context as any, next as any);
  return cls;
}

describe('IntegrationCallerInterceptor', () => {
  it('marks OAuth requests as integration calls', () => {
    const cls = intercept('oauth_access');
    expect(cls.set).toHaveBeenCalledWith(INTEGRATION_CALLER_KEY, true);
  });

  it('leaves API key and session requests unmarked', () => {
    expect(intercept('api_key').set).not.toHaveBeenCalled();
    expect(intercept('access').set).not.toHaveBeenCalled();
  });
});
