import { SetMetadata } from '@nestjs/common';

export const DOCOPS_ROLES_KEY = 'docopsRoles';
export const DocOpsRoles = (...roles: string[]) =>
  SetMetadata(DOCOPS_ROLES_KEY, roles);
