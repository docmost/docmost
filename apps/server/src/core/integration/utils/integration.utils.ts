import { ProviderAccount } from '../registry/integration-provider.interface';

export function normalizeBaseUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

export function escapeForRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function toProviderAccount(fields: {
  id: unknown;
  displayName?: unknown;
  username?: unknown;
}): ProviderAccount {
  const id =
    typeof fields.id === 'number'
      ? String(fields.id)
      : stringOrUndefined(fields.id);
  if (!id) {
    throw new Error('Provider profile has no account id');
  }
  const displayName = stringOrUndefined(fields.displayName)?.trim();
  const username = stringOrUndefined(fields.username)?.trim();
  return {
    id,
    ...(displayName ? { displayName } : {}),
    ...(username ? { username } : {}),
  };
}
