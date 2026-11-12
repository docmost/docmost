import { EnvironmentService } from './environment.service';

const environment = (env: Record<string, string> = {}) =>
  new EnvironmentService({
    get: (key: string, fallback?: string) => env[key] ?? fallback,
  } as any);

describe('EnvironmentService', () => {
  describe('getPageHistoryInterval', () => {
    it('defaults to five minutes', () => {
      expect(environment().getPageHistoryInterval()).toBe(5 * 60 * 1000);
    });

    it('reads a duration', () => {
      expect(
        environment({ PAGE_HISTORY_INTERVAL: '2m' }).getPageHistoryInterval(),
      ).toBe(2 * 60 * 1000);
    });

    it('never goes below one minute', () => {
      expect(
        environment({ PAGE_HISTORY_INTERVAL: '10s' }).getPageHistoryInterval(),
      ).toBe(60 * 1000);
    });

    it('falls back to five minutes for an empty or unreadable value', () => {
      expect(
        environment({ PAGE_HISTORY_INTERVAL: '' }).getPageHistoryInterval(),
      ).toBe(5 * 60 * 1000);
      expect(
        environment({ PAGE_HISTORY_INTERVAL: 'soon' }).getPageHistoryInterval(),
      ).toBe(5 * 60 * 1000);
    });
  });
});
