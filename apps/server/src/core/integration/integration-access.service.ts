import { Injectable } from '@nestjs/common';
import {
  Integration,
  IntegrationConnection,
} from '@docmost/db/types/entity.types';
import { IntegrationRegistry } from './registry/integration-registry';
import { IntegrationRepo } from './repos/integration.repo';
import { IntegrationConnectionRepo } from './repos/integration-connection.repo';
import { OAuthService } from './oauth/oauth.service';
import {
  IntegrationProvider,
  TokenInvalidError,
  UnfurlNeedsConnection,
} from './registry/integration-provider.interface';

export class IntegrationNotInstalledError extends Error {
  constructor(type: string) {
    super(`${type} is not installed in this workspace`);
    this.name = 'IntegrationNotInstalledError';
  }
}

export class IntegrationNeedsConnectionError extends Error {
  constructor(readonly details: UnfurlNeedsConnection) {
    super('User has not connected this integration');
    this.name = 'IntegrationNeedsConnectionError';
  }
}

export type UserIntegrationAccess = {
  integration: Integration;
  connection: IntegrationConnection;
  accessToken: string;
};

@Injectable()
export class IntegrationAccessService {
  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly integrationRepo: IntegrationRepo,
    private readonly connectionRepo: IntegrationConnectionRepo,
    private readonly oauthService: OAuthService,
  ) {}

  async getUserAccess(
    type: string,
    userId: string,
    workspaceId: string,
  ): Promise<UserIntegrationAccess> {
    const integration = await this.integrationRepo.findByWorkspaceAndType(workspaceId, type);
    const provider = this.registry.getProvider(type);
    if (!integration || !provider) {
      throw new IntegrationNotInstalledError(type);
    }

    const connection = await this.connectionRepo.findByIntegrationAndUser(integration.id, userId);
    if (
      !connection ||
      connection.kind !== 'user' ||
      connection.invalidatedAt ||
      !connection.accessToken
    ) {
      throw this.needsConnection(provider, integration.id);
    }

    try {
      const accessToken = await this.oauthService.getValidAccessToken(connection);
      return { integration, connection, accessToken };
    } catch (err) {
      if (err instanceof TokenInvalidError) {
        await this.invalidateConnection(connection);
        throw this.needsConnection(provider, integration.id);
      }
      throw err;
    }
  }

  // Spares a connection whose token the refresh job replaced after it was read.
  async invalidateConnection(connection: IntegrationConnection): Promise<void> {
    await this.connectionRepo.invalidate(connection.id, {
      accessToken: connection.accessToken,
    });
  }

  private needsConnection(
    provider: IntegrationProvider,
    integrationId: string,
  ): IntegrationNeedsConnectionError {
    return new IntegrationNeedsConnectionError({
      needsConnection: true,
      integrationId,
      integrationType: provider.definition.type,
      integrationName: provider.definition.name,
      title: provider.definition.name,
    });
  }
}
