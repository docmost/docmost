import type {
  Integration,
  IntegrationDefinition,
  UserConnection,
} from "../types/integration.types";

// The provider a `?connect=<type>` deep link should prompt for, if any.
export function resolveConnectPrompt(
  connectType: string | null,
  available: IntegrationDefinition[] | undefined,
  installed: Integration[] | undefined,
  myConnections: UserConnection[] | undefined,
): IntegrationDefinition | null {
  if (!connectType) return null;
  const definition = available?.find((d) => d.type === connectType);
  if (!definition || !definition.capabilities.includes("oauth")) return null;
  if (!installed?.some((i) => i.type === connectType)) return null;
  const live = myConnections?.find(
    (c) => c.type === connectType && !c.invalidatedAt,
  );
  return live ? null : definition;
}
