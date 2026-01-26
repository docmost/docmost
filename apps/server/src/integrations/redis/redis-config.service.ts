import { Injectable } from '@nestjs/common';
import { RedisOptions } from 'ioredis';
import { EnvironmentService } from '../environment/environment.service';

export type RedisFamily = 4 | 6;

@Injectable()
export class RedisConfigService {
  constructor(private readonly env: EnvironmentService) {}

  getOptions(): RedisOptions {
    const url = new URL(this.env.getRedisUrl());

    const family: RedisFamily = url.searchParams.get('family') === '6' ? 6 : 4;

    const tlsEnabled = this.env.getRedisEnableTLS();

    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      db: url.pathname ? Number(url.pathname.slice(1)) || 0 : 0,
      family,

      ...(tlsEnabled
        ? {
            tls: {
              servername: this.env.getRedisTlsServername() ?? url.hostname,
              rejectUnauthorized: this.env.getRedisTlsRejectUnauthorized(),
            },
          }
        : {}),

      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      connectTimeout: 10_000,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    };
  }
}