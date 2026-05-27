import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DOCOPS_ROLES_KEY } from '../decorators/docops-roles.decorator';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';

// docops_roles is not included in the JWT user payload (UserRepo.baseFields
// doesn't select it). We do a single lightweight lookup here instead of
// modifying the upstream UserRepo.
@Injectable()
export class DocOpsRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      DOCOPS_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId: string = request?.user?.user?.id;

    if (!userId) {
      throw new ForbiddenException();
    }

    const result = await sql<{ docopsRoles: string[] }>`
      SELECT docops_roles FROM users WHERE id = ${userId}
    `.execute(this.db);

    const userRoles: string[] = result.rows[0]?.docopsRoles ?? [];

    const hasRole = required.some((r) => userRoles.includes(r));
    if (!hasRole) {
      throw new ForbiddenException(
        `Required role: ${required.join(' or ')}`,
      );
    }

    return true;
  }
}
