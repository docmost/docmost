import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IntegrationRepo } from './repos/integration.repo';
import { IntegrationRegistry } from './registry/integration-registry';
import { Integration } from '@docmost/db/types/entity.types';
import { validateIntegrationSettings } from './dto/integration-settings.schema';

@Injectable()
export class IntegrationService {
  constructor(
    private readonly integrationRepo: IntegrationRepo,
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
    if (!provider) {
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
    await this.integrationRepo.softDelete(integrationId);
  }

  async update(
    integrationId: string,
    workspaceId: string,
    data: { settings?: Record<string, any>; isEnabled?: boolean },
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
      ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
    });
  }
}
