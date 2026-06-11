import { IntegrationListItem, IntegrationResourceManifest } from "@/features/integrations/types/integration.types";

export interface RegisteredIntegrationResource extends IntegrationResourceManifest {
  integrationId: string;
  integrationName: string;
}

let integrations: IntegrationListItem[] = [];

export function setRegisteredIntegrationCatalog(items: IntegrationListItem[]): void {
  integrations = items;
}

export function getRegisteredIntegrationIds(): Set<string> {
  return new Set(integrations.map((i) => i.id));
}

export function getRegisteredIntegrationResources(): RegisteredIntegrationResource[] {
  return integrations.flatMap((integration) =>
    (integration.resources ?? []).map((resource) => ({
      ...resource,
      integrationId: integration.id,
      integrationName: integration.name,
    })),
  );
}

export function findRegisteredIntegrationResource(
  integrationId: string,
  resourceId: string,
): RegisteredIntegrationResource | undefined {
  return getRegisteredIntegrationResources().find(
    (resource) => resource.integrationId === integrationId && resource.id === resourceId,
  );
}

export interface IntegrationEmbedTextMatch {
  index: number;
  text: string;
  data: {
    integrationId: string;
    resourceId: string;
    resourceKey: string;
    renderKind: string;
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches editor text against the url patterns declared by registered
 * integration resources (base URL + manifest pattern + a trailing space, the
 * paste-to-embed trigger). Returns the first match as embed node attributes.
 * Backs the editor's generic integration input rule, so embeds keep working
 * for whatever providers the server has registered — nothing provider-specific
 * ships in the editor bundle.
 */
export function matchIntegrationEmbedText(
  text: string,
): IntegrationEmbedTextMatch | null {
  for (const integration of integrations) {
    const base = (integration.baseUrl ?? "").replace(/\/+$/, "");
    if (!base) continue;
    for (const resource of integration.resources ?? []) {
      for (const urlPattern of resource.urlPatterns ?? []) {
        let find: RegExp;
        try {
          find = new RegExp(`${escapeRegExp(base)}${urlPattern.pattern}\\s$`);
        } catch {
          continue;
        }
        const match = find.exec(text);
        if (!match) continue;
        const resourceKey = urlPattern.resourceKey.replace(
          /\{(\w+)\}/g,
          (_, group) => match.groups?.[group] ?? "",
        );
        return {
          index: match.index,
          text: match[0],
          data: {
            integrationId: integration.id,
            resourceId: resource.id,
            resourceKey,
            renderKind: resource.renderKind,
          },
        };
      }
    }
  }
  return null;
}
