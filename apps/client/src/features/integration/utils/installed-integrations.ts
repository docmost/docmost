import { queryClient } from "@/main.tsx";
import { Integration } from "@/features/integration/types/integration.types";

export function isIntegrationInstalled(provider: string): boolean {
  const installed = queryClient.getQueryData<Integration[]>(["installed-integrations"]);
  return Boolean(installed?.some((integration) => integration.type === provider));
}
