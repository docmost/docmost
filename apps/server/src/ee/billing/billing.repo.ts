import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

@Injectable()
export class BillingRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByWorkspaceId(workspaceId: string) {
    return this.db
      .selectFrom('billing')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }
}
