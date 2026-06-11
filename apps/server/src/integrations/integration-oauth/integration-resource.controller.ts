import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { IntegrationOAuthRegistry } from './manifest.registry';
import {
  IntegrationOAuthClientService,
  IntegrationNotConfiguredError,
  IntegrationNotConnectedError,
  IntegrationReconnectRequiredError,
} from './integration-oauth-client.service';
import { createScopedResourceClient } from './integration-resource-client';
import { IntegrationResourceManifest } from './resource.types';

/**
 * Generic editor resource controller. Handlers call the resource manifest's
 * search/resolve functions with a scoped client that enforces the resource's
 * declared outbound-path allowlist; raw browser paths, methods, headers, or
 * query strings are never forwarded to the provider.
 */
@Controller('integrations/:integrationId/resources/:resourceId')
@UseGuards(JwtAuthGuard)
export class IntegrationResourceController {
  private readonly logger = new Logger(IntegrationResourceController.name);

  constructor(
    private readonly registry: IntegrationOAuthRegistry,
    private readonly clientService: IntegrationOAuthClientService,
  ) {}

  @Get('search')
  async search(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Param('integrationId') integrationId: string,
    @Param('resourceId') resourceId: string,
    @Query('q') q: string | undefined,
    @Query('limit') limit: string | undefined,
  ): Promise<{ items: unknown[] }> {
    const resource = this.requireResource(integrationId, resourceId);
    if (!resource.search) return { items: [] };

    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    const items = await this.wrap(integrationId, resourceId, () =>
      resource.search!(
        this.buildContext(resource, integrationId, workspace.id, user.id),
        {
          q,
          limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
        },
      ),
    );
    return { items };
  }

  @Get('resolve')
  async resolve(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Param('integrationId') integrationId: string,
    @Param('resourceId') resourceId: string,
    @Query('key') key: string | undefined,
    @Query('params') paramsJson: string | undefined,
  ): Promise<unknown> {
    const resource = this.requireResource(integrationId, resourceId);
    if (!key) {
      throw new HttpException(
        {
          code: 'INTEGRATION_RESOURCE_BAD_REQUEST',
          message: 'Missing resource key',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const params = this.parseParams(paramsJson);
    return this.wrap(integrationId, resourceId, () =>
      resource.resolve(
        this.buildContext(resource, integrationId, workspace.id, user.id),
        { resourceKey: key, params },
      ),
    );
  }

  private buildContext(
    resource: IntegrationResourceManifest,
    integrationId: string,
    workspaceId: string,
    userId: string,
  ) {
    return {
      integrationId,
      workspaceId,
      userId,
      client: createScopedResourceClient(this.clientService, resource, {
        integrationId,
        workspaceId,
        userId,
      }),
    };
  }

  private requireResource(integrationId: string, resourceId: string) {
    const manifest = this.registry.getForIntegrationId(integrationId);
    if (!manifest) {
      throw new NotFoundException(`Unknown integration: ${integrationId}`);
    }
    const resource = manifest.resources?.find((r) => r.id === resourceId);
    if (!resource) {
      throw new NotFoundException(
        `Unknown integration resource: ${integrationId}/${resourceId}`,
      );
    }
    return resource;
  }

  private parseParams(
    paramsJson: string | undefined,
  ): Record<string, unknown> | undefined {
    if (!paramsJson) return undefined;
    try {
      const parsed = JSON.parse(paramsJson) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // handled below
    }
    throw new HttpException(
      {
        code: 'INTEGRATION_RESOURCE_BAD_REQUEST',
        message: 'Invalid params JSON',
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  private async wrap<T>(
    integrationId: string,
    resourceId: string,
    call: () => Promise<T>,
  ): Promise<T> {
    try {
      return await call();
    } catch (err) {
      if (err instanceof IntegrationNotConfiguredError) {
        throw new HttpException(
          {
            code: 'INTEGRATION_NOT_CONFIGURED',
            message: `Ask a workspace admin to configure ${integrationId}`,
          },
          HttpStatus.CONFLICT,
        );
      }
      if (err instanceof IntegrationNotConnectedError) {
        throw new HttpException(
          {
            code: 'INTEGRATION_NOT_CONNECTED',
            message: `Connect ${integrationId} to use this embed`,
          },
          HttpStatus.CONFLICT,
        );
      }
      if (err instanceof IntegrationReconnectRequiredError) {
        throw new HttpException(
          {
            code: 'INTEGRATION_RECONNECT_REQUIRED',
            message: `Reconnect ${integrationId} to refresh access`,
          },
          HttpStatus.CONFLICT,
        );
      }

      const status = (err as { status?: number }).status;
      if (typeof status === 'number' && status >= 400 && status < 600) {
        throw new HttpException(
          {
            code: 'INTEGRATION_PROVIDER_HTTP_ERROR',
            status,
            message: (err as Error).message,
          },
          status,
        );
      }

      this.logger.warn(
        `Integration resource failed integration=${integrationId} resource=${resourceId}: ${(err as Error).message}`,
      );
      throw new HttpException(
        {
          code: 'INTEGRATION_RESOURCE_ERROR',
          message: 'Integration resource failed',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
