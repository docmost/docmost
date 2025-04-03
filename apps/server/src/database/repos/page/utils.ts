import { SpaceRole as PageRole } from '../../../common/helpers/types/permission';
import { UserPageRole } from './types';

export function findHighestUserPageRole(userPageRoles: UserPageRole[]) {
  if (!userPageRoles) {
    return undefined;
  }

  const roleOrder: { [key in PageRole]: number } = {
    [PageRole.ADMIN]: 3,
    [PageRole.WRITER]: 2,
    [PageRole.READER]: 1,
  };
  let highestRole: string;

  for (const userPageRole of userPageRoles) {
    const currentRole = userPageRole.role;
    if (!highestRole || roleOrder[currentRole] > roleOrder[highestRole]) {
      highestRole = currentRole;
    }
  }
  return highestRole;
}
