import { Injectable, NotFoundException } from '@nestjs/common';
import { IntegrationConnectionRepo } from './repos/integration-connection.repo';
import { IntegrationRepo } from './repos/integration.repo';
import { IntegrationConnection } from '@docmost/db/types/entity.types';
import { UnfurlService } from './unfurl/unfurl.service';

@Injectable()
export class IntegrationConnectionService {
  constructor(
    private readonly connectionRepo: IntegrationConnectionRepo,
    private readonly integrationRepo: IntegrationRepo,
    private readonly unfurlService: UnfurlService,
  ) {}

  async getConnectionStatus(
    integrationId: string,
    userId: string,
    workspaceId: string,
  ): Promise<{ connected: boolean; providerUserId?: string }> {
    const integration = await this.integrationRepo.findById(integrationId);
    if (!integration || integration.workspaceId !== workspaceId) {
      throw new NotFoundException('Integration not found');
    }

    const connection = await this.connectionRepo.findByIntegrationAndUser(
      integrationId,
      userId,
    );

    return {
      connected: !!connection && !connection.invalidatedAt,
      providerUserId: connection?.providerUserId ?? undefined,
    };
  }

  async findByIntegrationAndUser(
    integrationId: string,
    userId: string,
  ): Promise<IntegrationConnection | undefined> {
    return this.connectionRepo.findByIntegrationAndUser(integrationId, userId);
  }

  async findByWorkspaceTypeAndUser(
    workspaceId: string,
    integrationType: string,
    userId: string,
  ): Promise<IntegrationConnection | undefined> {
    return this.connectionRepo.findByWorkspaceTypeAndUser(
      workspaceId,
      integrationType,
      userId,
    );
  }

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

    await this.connectionRepo.deleteByIntegrationAndUser(
      integrationId,
      userId,
    );

    await this.unfurlService.purgeUserCache(workspaceId, userId);
  }
}
