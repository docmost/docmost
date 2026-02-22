import { Injectable, NotFoundException } from '@nestjs/common';
import { IntegrationConnectionRepo } from './repos/integration-connection.repo';
import { IntegrationRepo } from './repos/integration.repo';
import { IntegrationConnection } from '@docmost/db/types/entity.types';

@Injectable()
export class IntegrationConnectionService {
  constructor(
    private readonly connectionRepo: IntegrationConnectionRepo,
    private readonly integrationRepo: IntegrationRepo,
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
      connected: !!connection,
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
  }
}
