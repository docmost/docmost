import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import { Block } from '@docmost/db/types/entity.types';

@Injectable()
export class BlockRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  private baseFields: Array<keyof Block> = [
    'id',
    'pageId',
    'content',
  ];

  async findById(
    pageId: string,
    opts?: {
      includeContent?: boolean;
      includeYdoc?: boolean;
      includeSpace?: boolean;
      includeCreator?: boolean;
      includeLastUpdatedBy?: boolean;
      includeContributors?: boolean;
      withLock?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<Block> {
    const db = dbOrTx(this.db, opts?.trx);

    const query = db
      .selectFrom('blocks')
      .select(this.baseFields);

    return query.executeTakeFirst();
  }
}
