import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';

@Injectable()
export class CrEditLockGuard implements CanActivate {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const pageId: string | undefined = request.body?.pageId;

    if (!pageId || !user?.id) return true;

    // Check if page is locked under an active CR
    const page = await this.db
      .selectFrom('pages')
      .select(['crDraftId'])
      .where('id', '=', pageId)
      .executeTakeFirst();

    if (!page?.crDraftId) return true;

    // Page is locked: only the assigned implementer can edit
    const cr = await sql<{ implementer_id: string | null; status: string }>`
      SELECT implementer_id, status
      FROM change_requests
      WHERE id = ${page.crDraftId}
    `.execute(this.db);

    const crRow = cr.rows[0];
    if (!crRow || crRow.status !== 'IN_IMPLEMENTATION') return true;

    if (crRow.implementer_id !== user.id) {
      throw new ForbiddenException(
        'Page is locked under an active change request assigned to another user',
      );
    }

    return true;
  }
}
