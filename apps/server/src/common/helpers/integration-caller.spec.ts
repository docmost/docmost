import { AsyncLocalStorage } from 'async_hooks';
import { ClsService } from 'nestjs-cls';
import {
  isIntegrationCaller,
  markIntegrationCaller,
} from './integration-caller';

describe('integration caller mark', () => {
  const cls = () => new ClsService(new AsyncLocalStorage());

  it('throws when there is no CLS context to carry the mark', () => {
    expect(() => markIntegrationCaller(cls())).toThrow(Error);
  });

  it('marks the request inside a CLS context', () => {
    const service = cls();
    service.run(() => {
      expect(isIntegrationCaller(service)).toBe(false);
      markIntegrationCaller(service);
      expect(isIntegrationCaller(service)).toBe(true);
    });
  });

  it('is not an integration caller outside a context', () => {
    expect(isIntegrationCaller(cls())).toBe(false);
  });
});
