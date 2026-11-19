import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  CacheKey,
  LATEST_VERSION_CACHE_TTL_MS,
} from '../../common/helpers/cache-keys';
import { EnvironmentService } from '../environment/environment.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('./../../../package.json');

@Injectable()
export class VersionService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly environmentService: EnvironmentService,
  ) {}

  async getVersion() {
    const url = 'https://version.docmost.com/api/version';

    let latestVersion: string | number = 0;
    if (!this.environmentService.isDisableVersionCheck()) {
      try {
        const cached = await this.cacheManager.get<string>(
          CacheKey.LATEST_VERSION,
        );
        if (cached) {
          latestVersion = cached;
        } else {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(5_000),
          });
          if (response.ok) {
            const data = await response.json();
            if (
              typeof data?.latestVersion === 'string' &&
              data.latestVersion
            ) {
              latestVersion = data.latestVersion;
              await this.cacheManager.set(
                CacheKey.LATEST_VERSION,
                latestVersion,
                LATEST_VERSION_CACHE_TTL_MS,
              );
            }
          }
        }
      } catch (err) {
        /* empty */
      }
    }

    return {
      currentVersion: packageJson?.version,
      latestVersion: latestVersion,
      releaseUrl: 'https://github.com/docmost/docmost/releases',
    };
  }
}
