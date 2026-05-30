import { UserRole } from '../../common/helpers/types/permission';

export function isAdminActingOnOwner(
  authUserRole: string,
  targetRole: string,
): boolean {
  return authUserRole === UserRole.ADMIN && targetRole === UserRole.OWNER;
}
