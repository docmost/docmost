import { BadRequestException } from '@nestjs/common';
import { UserRole } from '../../common/helpers/types/permission';

export function isAdminActingOnOwner(
  authUserRole: string,
  targetRole: string,
): boolean {
  return authUserRole === UserRole.ADMIN && targetRole === UserRole.OWNER;
}

export type TrustedOAuthClient = { origin: string; name: string };

// Origins must be exact https origins; duplicates collapse case-insensitively, last entry wins.
export function normalizeTrustedOAuthClients(
  entries: { origin: string; name: string }[],
): TrustedOAuthClient[] {
  const byOrigin = new Map<string, TrustedOAuthClient>();
  for (const entry of entries) {
    const name = entry.name.trim();
    if (name.length < 1 || name.length > 64) {
      throw new BadRequestException(
        `Invalid trusted application name for origin: ${entry.origin}`,
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(entry.origin);
    } catch {
      throw new BadRequestException(
        `Invalid trusted application origin: ${entry.origin}`,
      );
    }
    if (parsed.protocol !== 'https:' || parsed.origin !== entry.origin) {
      throw new BadRequestException(
        `Trusted application origin must be an exact https origin: ${entry.origin}`,
      );
    }
    const origin = entry.origin.toLowerCase();
    byOrigin.set(origin, { origin, name });
  }
  return Array.from(byOrigin.values());
}

export type PageEditMode = 'read' | 'edit';

export function getWorkspaceDefaultPageEditMode(
  workspace: { settings?: unknown } | null | undefined,
): PageEditMode | undefined {
  const settings = (workspace?.settings ?? {}) as {
    defaultPageEditMode?: unknown;
  };
  const mode = settings.defaultPageEditMode;
  if (mode === 'read' || mode === 'edit') {
    return mode;
  }
  return undefined;
}
