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

// Slashes, controls, bidi or zero-width marks and line separators can disguise a link's display text.
const UNSAFE_DISPLAY_TEXT = /[\/\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

export function encodeUnsafeText(text: string): string {
  return text.replace(UNSAFE_DISPLAY_TEXT, encodeURIComponent);
}

export function safeDecodeText(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return encodeUnsafeText(value);
  }
  return encodeUnsafeText(decoded) === decoded
    ? decoded
    : encodeUnsafeText(value);
}
