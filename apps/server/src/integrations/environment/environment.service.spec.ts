import { ConfigService } from '@nestjs/config';
import { EnvironmentService } from './environment.service';

function createService(env: Record<string, string>) {
  return new EnvironmentService(new ConfigService(env));
}

describe('EnvironmentService', () => {
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
