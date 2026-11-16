import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  CacheKey,
  LATEST_VERSION_CACHE_TTL_MS,
} from '../../common/helpers/cache-keys';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('./../../../package.json');

@Injectable()
export class VersionService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async getVersion() {
    const url = `https://api.github.com/repos/docmost/docmost/releases/latest`;

    let latestVersion: string | number = 0;
    try {
      const cached = await this.cacheManager.get<string>(
        CacheKey.LATEST_VERSION,
      );
      if (cached) {
        latestVersion = cached;
      } else {
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();
        latestVersion = data?.tag_name?.replace('v', '');
        await this.cacheManager.set(
          CacheKey.LATEST_VERSION,
          latestVersion,
          LATEST_VERSION_CACHE_TTL_MS,
        );
      }
    } catch (err) {
      /* empty */
    }

    return {
      currentVersion: packageJson?.version,
      latestVersion: latestVersion,
      releaseUrl: 'https://github.com/docmost/docmost/releases',
    };
  }
}
