import { Injectable } from '@nestjs/common';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

export type QueryCacheConfig = {
  enabled: boolean;
  minRows: number;
  maxCollections: number;
  warmTopN: number;
};

@Injectable()
export class QueryCacheConfigProvider {
  readonly config: QueryCacheConfig;
  constructor(env: EnvironmentService) {
    this.config = {
      enabled: env.getBaseQueryCacheEnabled(),
      minRows: env.getBaseQueryCacheMinRows(),
      maxCollections: env.getBaseQueryCacheMaxCollections(),
      warmTopN: env.getBaseQueryCacheWarmTopN(),
    };
  }
}
