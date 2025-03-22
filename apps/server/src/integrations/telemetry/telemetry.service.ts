import { Injectable } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { EnvironmentService } from '../environment/environment.service';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { createHmac } from 'node:crypto';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('./../../../package.json');

@Injectable()
export class TelemetryService {
  constructor(
    private readonly environmentService: EnvironmentService,
    @InjectKysely() private readonly db: KyselyDB,
    private readonly workspaceRepo: WorkspaceRepo,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'telemetry',
  })
  async sendTelemetry() {
    if (
      this.environmentService.isDisableTelemetry() ||
      this.environmentService.isCloud() ||
      this.environmentService.getNodeEnv() !== 'production'
    ) {
      this.schedulerRegistry.deleteCronJob('telemetry');
      return;
    }

    try {
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

      const telemetryUrl = 'https://event.docmost.com/api/event';

      const response = await fetch(telemetryUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'docmost:' + data.version,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      console.log(response.json());
    } catch (err) {
      /* empty */
    }
  }
}
