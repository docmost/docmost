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
import { IntegrationWebhookRepo } from './repos/integration-webhook.repo';
import { IntegrationRegistry } from './registry/integration-registry';
import { Integration } from '@docmost/db/types/entity.types';
import { validateIntegrationSettings } from './dto/integration-settings.schema';

@Injectable()
export class IntegrationService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly integrationRepo: IntegrationRepo,
    private readonly connectionRepo: IntegrationConnectionRepo,
    private readonly webhookRepo: IntegrationWebhookRepo,
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
      await this.webhookRepo.deleteByIntegration(integrationId, trx);
      await this.integrationRepo.softDelete(integrationId, trx);
    });
  }

  async update(
    integrationId: string,
    workspaceId: string,
    data: { settings?: Record<string, any> },
  ): Promise<Integration> {
    const integration = await this.integrationRepo.findById(integrationId);
    if (!integration || integration.workspaceId !== workspaceId) {
      throw new NotFoundException('Integration not found');
    }

    if (data.settings !== undefined) {
      const validation = validateIntegrationSettings(
        integration.type,
        data.settings,
      );
      if (validation.success === false) {
        throw new BadRequestException(`Invalid settings: ${validation.error}`);
      }
      data.settings = validation.data;
    }

    return this.integrationRepo.update(integrationId, {
      ...(data.settings !== undefined && { settings: data.settings }),
    });
  }
}
