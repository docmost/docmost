import { IntegrationOAuthClientService } from './integration-oauth-client.service';
import {
  IntegrationResourceClient,
  IntegrationResourceManifest,
} from './resource.types';

/**
 * Compiles a declared outbound path ('/api/items/:id') into a matcher.
 * `:param` segments match exactly one path segment; everything else is
 * matched literally.
 */
function compileOutboundPath(pattern: string): RegExp {
  const segments = pattern
    .split('/')
    .map((segment) =>
      segment.startsWith(':') && segment.length > 1
        ? '[^/]+'
        : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
  return new RegExp(`^${segments.join('/')}$`);
}

/**
 * Binds the outbound client to one (integration, workspace, user, resource)
 * and enforces the resource's declared `security.outboundPaths` allowlist.
 * Resource handlers never see the unscoped client, so a provider bug cannot
 * reach paths it did not declare.
 */
export function createScopedResourceClient(
  clientService: IntegrationOAuthClientService,
  resource: IntegrationResourceManifest,
  scope: { integrationId: string; workspaceId: string; userId: string },
): IntegrationResourceClient {
  const allowedPaths = (resource.security?.outboundPaths ?? []).map(
    compileOutboundPath,
  );

  return {
    get<T = unknown>(
      path: string,
      query?: Record<string, string | number | undefined>,
    ): Promise<T> {
      if (!allowedPaths.some((re) => re.test(path))) {
        return Promise.reject(
          new Error(
            `Outbound path not declared in resource '${resource.id}' security.outboundPaths: ${path}`,
          ),
        );
      }
      return clientService.get<T>(
        scope.integrationId,
        scope.workspaceId,
        scope.userId,
        path,
        query,
      );
    },
    baseUrl(): Promise<string> {
      return clientService.baseUrl(scope.integrationId, scope.workspaceId);
    },
    settings(): Promise<Record<string, string>> {
      return clientService.settings(scope.integrationId, scope.workspaceId);
    },
  };
}
