import { useEffect } from "react";
import { useGetIntegrationsQuery } from "@/features/integrations/queries/integration-oauth-query";
import { setRegisteredIntegrations } from "@/features/editor/components/slash-menu/menu-items";
import { setRegisteredIntegrationCatalog } from "@/features/integrations/integration-resource-registry";

/**
 * Mirrors the server's registered-integrations list into the slash-menu's
 * static gate so items tagged `requiresIntegration` hide when the server
 * has no manifest for that id. Mounted once in the global layout.
 */
export function useSyncRegisteredIntegrations(): void {
  const { data } = useGetIntegrationsQuery();

  useEffect(() => {
    if (!Array.isArray(data)) return;
    setRegisteredIntegrationCatalog(data);
    setRegisteredIntegrations(data.map((i) => i.id));
  }, [data]);
}
