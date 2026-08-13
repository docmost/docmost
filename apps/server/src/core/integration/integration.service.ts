import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { IntegrationRepo } from './repos/integration.repo';
import { IntegrationConnectionRepo } from './repos/integration-connection.repo';
import { IntegrationRegistry } from './registry/integration-registry';
import { Integration } from '@docmost/db/types/entity.types';

@Injectable()
export class IntegrationService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly integrationRepo: IntegrationRepo,
    private readonly connectionRepo: IntegrationConnectionRepo,
    private readonly registry: IntegrationRegistry,
  ) {}

  async getAvailableIntegrations() {
    return this.registry.getAvailableIntegrations();
  }

  async getInstalledIntegrations(workspaceId: string): Promise<Integration[]> {
    return this.integrationRepo.findAllByWorkspace(workspaceId);
  }

  async findById(integrationId: string): Promise<Integration | undefined> {
    return this.integrationRepo.findById(integrationId);
  }

  async install(
    type: string,
    workspaceId: string,
    userId: string,
  ): Promise<Integration> {
    const provider = this.registry.getProvider(type);
    if (!provider || provider.definition.hidden) {
      throw new BadRequestException(`Unknown integration type: ${type}`);
    }

    // OAuth providers install via install-and-authorize (see OAuthService).
    if (provider.definition.oauth) {
      throw new BadRequestException(
        'This integration is installed by completing its OAuth flow',
      );
    }

    const existing = await this.integrationRepo.findByWorkspaceAndType(
      workspaceId,
      type,
    );
    if (existing) {
      throw new BadRequestException(
        `Integration "${type}" is already installed`,
      );
    }

    return this.integrationRepo.insertOrRestore({
      type,
      workspaceId,
      installedById: userId,
    });
  }

  async uninstall(integrationId: string, workspaceId: string): Promise<void> {
    const integration = await this.integrationRepo.findById(integrationId);
    if (!integration || integration.workspaceId !== workspaceId) {
      throw new NotFoundException('Integration not found');
    }
    // Delete child rows first so no orphan connections keep feeding the token refresh scheduler.
    await executeTx(this.db, async (trx) => {
      await this.connectionRepo.deleteByIntegration(integrationId, trx);
      await this.integrationRepo.softDelete(integrationId, trx);
    });
  }
}
