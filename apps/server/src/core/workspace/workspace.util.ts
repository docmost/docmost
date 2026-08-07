import { UserRole } from '../../common/helpers/types/permission';

export function isAdminActingOnOwner(
  authUserRole: string,
  targetRole: string,
): boolean {
  return authUserRole === UserRole.ADMIN && targetRole === UserRole.OWNER;
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
