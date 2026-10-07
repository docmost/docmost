import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IntegrationConnectionRepo } from './repos/integration-connection.repo';
import { IntegrationRepo } from './repos/integration.repo';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';
import {
  AuditEvent,
  AuditResource,
} from '../../common/events/audit-events';

@Injectable()
export class IntegrationConnectionService {
  constructor(
    private readonly connectionRepo: IntegrationConnectionRepo,
    private readonly integrationRepo: IntegrationRepo,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async getUserConnections(userId: string, workspaceId: string) {
    const rows = await this.connectionRepo.findByUserAndWorkspace(
      userId,
      workspaceId,
    );

    return rows.map((row) => ({
      integrationId: row.integrationId,
      type: row.type,
      providerUserId: row.providerUserId ?? null,
      providerDisplayName:
        (row.metadata as { displayName?: string } | null)?.displayName ?? null,
      connectedAt: row.createdAt,
      invalidatedAt: row.invalidatedAt ?? null,
    }));
  }

  async disconnect(
    integrationId: string,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const integration = await this.integrationRepo.findById(integrationId);
    if (!integration || integration.workspaceId !== workspaceId) {
      throw new NotFoundException('Integration not found');
    }

    const disconnected = await this.connectionRepo.deleteByIntegrationAndUser(
      integrationId,
      userId,
    );

    if (disconnected) {
      this.auditService.log({
        event: AuditEvent.INTEGRATION_DISCONNECTED,
        resourceType: AuditResource.INTEGRATION,
        resourceId: integrationId,
        changes: { before: { provider: integration.type } },
      });
    }
  }
}
