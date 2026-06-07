import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

export interface HashablePage {
  id: string;
  title: string | null;
  slugId: string;
  spaceId: string;
  textContent: string | null;
  createdAt: Date;
}

@Injectable()
export class DedupRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async listPagesForHashing(
    workspaceId: string,
    spaceId?: string,
  ): Promise<HashablePage[]> {
    let query = this.db
      .selectFrom('pages')
      .select(['id', 'title', 'slugId', 'spaceId', 'textContent', 'createdAt'])
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null);

    if (spaceId) {
      query = query.where('spaceId', '=', spaceId);
    }

    return query.execute() as unknown as Promise<HashablePage[]>;
  }

  async upsertHash(
    pageId: string,
    workspaceId: string,
    sha256: string,
    charLen: number,
  ): Promise<void> {
    await this.db
      .insertInto('pageContentHashes')
      .values({ pageId, workspaceId, sha256, charLen, updatedAt: new Date() })
      .onConflict((oc) =>
        oc.column('pageId').doUpdateSet({
          sha256,
          charLen,
          updatedAt: new Date(),
        }),
      )
      .execute();
  }
}
