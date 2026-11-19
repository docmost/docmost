import { ConfigService } from '@nestjs/config';
import { EnvironmentService } from './environment.service';

function createService(env: Record<string, string>) {
  return new EnvironmentService(new ConfigService(env));
}

describe('EnvironmentService', () => {
  describe('getPageHistoryInterval', () => {
    it('defaults to five minutes', () => {
      expect(createService({}).getPageHistoryInterval()).toBe(5 * 60 * 1000);
    });

    it('reads a duration', () => {
      expect(
        createService({ PAGE_HISTORY_INTERVAL: '2m' }).getPageHistoryInterval(),
      ).toBe(2 * 60 * 1000);
    });

    it('never goes below one minute', () => {
      expect(
        createService({ PAGE_HISTORY_INTERVAL: '10s' }).getPageHistoryInterval(),
      ).toBe(60 * 1000);
    });

    it('falls back to five minutes for an empty or unreadable value', () => {
      expect(
        createService({ PAGE_HISTORY_INTERVAL: '' }).getPageHistoryInterval(),
      ).toBe(5 * 60 * 1000);
      expect(
        createService({ PAGE_HISTORY_INTERVAL: 'soon' }).getPageHistoryInterval(),
      ).toBe(5 * 60 * 1000);
    });
  });

  it('returns a configured value', () => {
    const service = createService({ FILE_UPLOAD_SIZE_LIMIT: '10mb' });
    expect(service.getFileUploadSizeLimit()).toBe('10mb');
  });

  it('falls back to the default when a value is unset', () => {
    expect(createService({}).getFileUploadSizeLimit()).toBe('50mb');
  });

  it('falls back to the default when a value is blank', () => {
    const service = createService({
      FILE_UPLOAD_SIZE_LIMIT: '',
      JWT_TOKEN_EXPIRES_IN: '',
    });
    expect(service.getFileUploadSizeLimit()).toBe('50mb');
    expect(service.getJwtTokenExpiresIn()).toBe('90d');
  });

  it('treats a blank value without a default as unset', () => {
    expect(createService({ DRAWIO_URL: '' }).getDrawioUrl()).toBeUndefined();
  });
});
