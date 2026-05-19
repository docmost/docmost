import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { EnvironmentService } from './environment.service';
import { LicenseCheckService } from './license-check.service';
import { Feature } from '../../common/features';

function buildConfig(values: Record<string, string | undefined>) {
  return {
    get: (key: string, defaultValue?: string) => values[key] ?? defaultValue,
  };
}

async function buildService(
  env: Record<string, string | undefined>,
  moduleRefOverrides?: Partial<ModuleRef>,
) {
  const moduleRef: Partial<ModuleRef> = {
    get: () => {
      throw new Error(
        'EE license module is not present in this OSS checkout. ' +
          'Demo-mode short-circuit must run before this is reached.',
      );
    },
    ...moduleRefOverrides,
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      EnvironmentService,
      LicenseCheckService,
      { provide: ConfigService, useValue: buildConfig(env) },
      { provide: ModuleRef, useValue: moduleRef },
    ],
  }).compile();

  return {
    licenseCheck: module.get(LicenseCheckService),
    env: module.get(EnvironmentService),
  };
}

describe('LicenseCheckService', () => {
  describe('when DEMO_ALL is unset (status quo)', () => {
    it('reports tier "free" from resolveTier()', async () => {
      const { licenseCheck } = await buildService({});
      expect(licenseCheck.resolveTier(undefined, undefined)).toBe('free');
    });

    it('reports an empty feature list from resolveFeatures()', async () => {
      const { licenseCheck } = await buildService({});
      expect(licenseCheck.resolveFeatures(undefined, undefined)).toEqual([]);
    });

    it('returns false from hasFeature() for any feature', async () => {
      const { licenseCheck } = await buildService({});
      expect(licenseCheck.hasFeature(undefined, Feature.SCIM)).toBe(false);
      expect(licenseCheck.hasFeature(undefined, Feature.AI)).toBe(false);
    });

    it('returns false from isValidEELicense()', async () => {
      const { licenseCheck } = await buildService({});
      expect(licenseCheck.isValidEELicense(undefined)).toBe(false);
    });

    it('returns an empty list from getFeatures()', async () => {
      const { licenseCheck } = await buildService({});
      expect(licenseCheck.getFeatures(undefined)).toEqual([]);
    });
  });

  describe('when DEMO_ALL is set to a non-canonical truthy value', () => {
    it('treats "1" as false (only literal "true" is honored)', async () => {
      const { licenseCheck, env } = await buildService({ DEMO_ALL: '1' });
      expect(env.isDemoAll()).toBe(false);
      expect(licenseCheck.resolveTier(undefined, undefined)).toBe('free');
    });

    it('treats "yes" as false', async () => {
      const { licenseCheck } = await buildService({ DEMO_ALL: 'yes' });
      expect(licenseCheck.resolveTier(undefined, undefined)).toBe('free');
    });
  });

  describe('when DEMO_ALL=true', () => {
    it('reports tier "enterprise" from resolveTier() without consulting any license module', async () => {
      const { licenseCheck } = await buildService({ DEMO_ALL: 'true' });
      expect(licenseCheck.resolveTier(undefined, undefined)).toBe('enterprise');
    });

    it('is case-insensitive on the value (TRUE)', async () => {
      const { licenseCheck } = await buildService({ DEMO_ALL: 'TRUE' });
      expect(licenseCheck.resolveTier(undefined, undefined)).toBe('enterprise');
    });

    it('returns every Feature.* value from resolveFeatures()', async () => {
      const { licenseCheck } = await buildService({ DEMO_ALL: 'true' });
      const all = Object.values(Feature);
      const result = licenseCheck.resolveFeatures(undefined, undefined);
      expect(new Set(result)).toEqual(new Set(all));
    });

    it('returns every Feature.* value from getFeatures()', async () => {
      const { licenseCheck } = await buildService({ DEMO_ALL: 'true' });
      const all = Object.values(Feature);
      expect(new Set(licenseCheck.getFeatures(undefined))).toEqual(
        new Set(all),
      );
    });

    it('returns true from hasFeature() for every defined Feature', async () => {
      const { licenseCheck } = await buildService({ DEMO_ALL: 'true' });
      for (const f of Object.values(Feature)) {
        expect(licenseCheck.hasFeature(undefined, f)).toBe(true);
      }
    });

    it('returns true from isValidEELicense() with no license key', async () => {
      const { licenseCheck } = await buildService({ DEMO_ALL: 'true' });
      expect(licenseCheck.isValidEELicense(undefined)).toBe(true);
    });

    it('takes precedence over CLOUD=true (does not consult the EE feature registry)', async () => {
      // ModuleRef.get is wired to throw; if the short-circuit runs first, no
      // require('../../ee/...') ever reaches ModuleRef, so the throw is never
      // triggered and the test passes. If the short-circuit is missing, the
      // cloud branch tries to load `feature-registry` and throws -> falls into
      // the existing catch block and returns false -> assertions below fail.
      const { licenseCheck } = await buildService({
        DEMO_ALL: 'true',
        CLOUD: 'true',
      });
      expect(licenseCheck.hasFeature(undefined, Feature.SCIM)).toBe(true);
      expect(licenseCheck.resolveFeatures(undefined, undefined).length).toBe(
        Object.values(Feature).length,
      );
    });
  });

  describe('EnvironmentService.isDemoAll() parsing', () => {
    it('returns false when DEMO_ALL is unset', async () => {
      const { env } = await buildService({});
      expect(env.isDemoAll()).toBe(false);
    });

    it('returns true when DEMO_ALL is the lowercase literal "true"', async () => {
      const { env } = await buildService({ DEMO_ALL: 'true' });
      expect(env.isDemoAll()).toBe(true);
    });

    it('returns true when DEMO_ALL is mixed-case "True"', async () => {
      const { env } = await buildService({ DEMO_ALL: 'True' });
      expect(env.isDemoAll()).toBe(true);
    });

    it('returns false for the empty string', async () => {
      const { env } = await buildService({ DEMO_ALL: '' });
      expect(env.isDemoAll()).toBe(false);
    });
  });
});
