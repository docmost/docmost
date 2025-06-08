import { Injectable } from '@nestjs/common';
import { Interval, SchedulerRegistry } from '@nestjs/schedule';
import { EnvironmentService } from '../environment/environment.service';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { createHmac } from 'node:crypto';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('./../../../package.json');

@Injectable()
export class TelemetryService {
  private readonly ENDPOINT_URL = 'https://tel.docmost.com/api/event';

  constructor(
    private readonly environmentService: EnvironmentService,
    @InjectKysely() private readonly db: KyselyDB,
    private readonly workspaceRepo: WorkspaceRepo,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  @Interval('telemetry', 24 * 60 * 60 * 1000)
  async sendTelemetry() {
    try {
      if (
        this.environmentService.isDisableTelemetry() ||
        this.environmentService.isCloud() ||
        this.environmentService.getNodeEnv() !== 'production'
      ) {
        this.schedulerRegistry.deleteInterval('telemetry');
        return;
      }

      const workspace = await this.workspaceRepo.findFirst();
      if (!workspace) {
        return;
      }

      const anonymizedHash = createHmac(
        'sha256',
        this.environmentService.getAppSecret(),
      )
        .update(workspace.id)
        .digest('hex');

      const { userCount } = await this.db
        .selectFrom('users')
        .select((eb) => eb.fn.count('id').as('userCount'))
        .executeTakeFirst();

      const { pageCount } = await this.db
        .selectFrom('pages')
        .select((eb) => eb.fn.count('id').as('pageCount'))
        .executeTakeFirst();

      const { workspaceCount } = await this.db
        .selectFrom('workspaces')
        .select((eb) => eb.fn.count('id').as('workspaceCount'))
        .executeTakeFirst();

      const { spaceCount } = await this.db
        .selectFrom('spaces')
        .select((eb) => eb.fn.count('id').as('spaceCount'))
        .executeTakeFirst();

      const data = {
        instanceId: anonymizedHash,
        version: packageJson.version,
        userCount,
        pageCount,
        spaceCount,
        workspaceCount,
      };

      await fetch(this.ENDPOINT_URL, {
        method: 'POST',
        headers: {
          'User-Agent': 'docmost:' + data.version,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    } catch (err) {
      /* empty */
    }
  }
}
