import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { IntegrationRepo } from './repos/integration.repo';
import { IntegrationConnectionRepo } from './repos/integration-connection.repo';
import { IntegrationRegistry } from './registry/integration-registry';
import { Integration } from '@docmost/db/types/entity.types';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';
import {
  AuditEvent,
  AuditResource,
} from '../../common/events/audit-events';

@Injectable()
export class IntegrationService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly integrationRepo: IntegrationRepo,
    private readonly connectionRepo: IntegrationConnectionRepo,
    private readonly registry: IntegrationRegistry,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async getAvailableIntegrations() {
    return this.registry.getAvailableIntegrations();
  }

  async getInstalledIntegrations(
    workspaceId: string,
  ): Promise<(Integration & { unfurlHosts?: string[] })[]> {
    const integrations =
      await this.integrationRepo.findAllByWorkspace(workspaceId);
    return integrations.map((integration) => {
      const unfurlHosts = this.registry
        .getProvider(integration.type)
        ?.getUnfurlHosts?.((integration.settings as Record<string, any>) ?? {});
      return unfurlHosts ? { ...integration, unfurlHosts } : integration;
    });
  }

  async uninstall(integrationId: string, workspaceId: string): Promise<void> {
    const integration = await this.integrationRepo.findById(integrationId);
    if (!integration || integration.workspaceId !== workspaceId) {
      throw new NotFoundException('Integration not found');
    }
    // Soft delete doesn't cascade to connections
    await executeTx(this.db, async (trx) => {
      await this.connectionRepo.deleteByIntegration(integrationId, trx);
      await this.integrationRepo.softDelete(integrationId, trx);
    });

    this.auditService.log({
      event: AuditEvent.INTEGRATION_UNINSTALLED,
      resourceType: AuditResource.INTEGRATION,
      resourceId: integrationId,
      changes: { before: { provider: integration.type } },
    });
  }
}
