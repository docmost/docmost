import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  EnvironmentVariables,
  getLdapEnvironmentErrors,
} from './environment.validation';

const baseConfig = {
  DATABASE_URL: 'postgres://localhost/docmost',
  REDIS_URL: 'redis://localhost:6379',
};

const validLdapConfig = {
  LDAP_ENABLED: 'true',
  LDAP_URL: 'ldaps://directory.example.com:636',
  LDAP_BIND_DN: 'cn=service,dc=example,dc=com',
  LDAP_BIND_PASSWORD: 'secret',
  LDAP_BASE_DN: 'dc=example,dc=com',
  LDAP_USER_SEARCH_FILTER: '(uid={{username}})',
  LDAP_USER_ID_ATTRIBUTE: 'entryUUID',
  LDAP_STARTTLS: 'false',
};

describe('LDAP environment validation', () => {
  it('does not require LDAP settings when LDAP is disabled', () => {
    const instance = plainToInstance(EnvironmentVariables, {
      ...baseConfig,
      LDAP_ENABLED: 'false',
    });

    const errors = validateSync(instance);
    expect(errors.map((error) => error.property)).not.toContain('LDAP_URL');
    expect(getLdapEnvironmentErrors({ LDAP_ENABLED: 'false' })).toEqual([]);
  });

  it('accepts a complete LDAP configuration', () => {
    const instance = plainToInstance(EnvironmentVariables, {
      ...baseConfig,
      ...validLdapConfig,
    });

    expect(validateSync(instance)).toEqual([]);
    expect(
      getLdapEnvironmentErrors({ ...validLdapConfig, NODE_ENV: 'production' }),
    ).toEqual([]);
  });

  it('requires the LDAP connection and identity settings when enabled', () => {
    const instance = plainToInstance(EnvironmentVariables, {
      ...baseConfig,
      LDAP_ENABLED: 'true',
    });

    const properties = validateSync(instance).map((error) => error.property);
    expect(properties).toContain('LDAP_URL');
    expect(properties).toContain('LDAP_BIND_DN');
    expect(properties).toContain('LDAP_BIND_PASSWORD');
    expect(properties).toContain('LDAP_BASE_DN');
    expect(properties).toContain('LDAP_USER_SEARCH_FILTER');
    expect(properties).toContain('LDAP_USER_ID_ATTRIBUTE');
  });

  it('rejects LDAP mode on Cloud and cleartext LDAP outside development/test', () => {
    expect(
      getLdapEnvironmentErrors({ ...validLdapConfig, CLOUD: 'true' }),
    ).toContain('LDAP_ENABLED=true is not supported when CLOUD=true');

    expect(
      getLdapEnvironmentErrors({
        ...validLdapConfig,
        LDAP_URL: 'ldap://directory.example.com:389',
        LDAP_STARTTLS: 'false',
        NODE_ENV: 'production',
      }),
    ).toContain('LDAP must use TLS in non-development environments');
  });

  it('rejects conflicting StartTLS and LDAPS settings', () => {
    expect(
      getLdapEnvironmentErrors({
        ...validLdapConfig,
        LDAP_STARTTLS: 'true',
      }),
    ).toContain('LDAP_STARTTLS cannot be enabled with an ldaps:// LDAP_URL');
  });
});