import { UserSpaceRole } from '@docmost/db/repos/space/types';
import { SpaceRole } from '../../../common/helpers/types/permission';

export function findHighestUserSpaceRole(userSpaceRoles: UserSpaceRole[]) {
  if (!userSpaceRoles) {
    return undefined;
  }

  const roleOrder: { [key in SpaceRole]: number } = {
    [SpaceRole.ADMIN]: 3,
    [SpaceRole.WRITER]: 2,
    [SpaceRole.READER]: 1,
  };
  let highestRole: string;

  for (const userSpaceRole of userSpaceRoles) {
    const currentRole = userSpaceRole.role;
    if (!highestRole || roleOrder[currentRole] > roleOrder[highestRole]) {
      highestRole = currentRole;
    }
  }
  return highestRole;
}
