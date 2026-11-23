import { Kysely, Transaction } from 'kysely';
import { DbInterface } from '@docmost/db/types/db.interface';
import type { CacheOptions } from '../../common/helpers/with-cache';

export type KyselyDB = Kysely<DbInterface>;
export type KyselyTransaction = Transaction<DbInterface>;
export type PermissionQueryOptions = CacheOptions & { trx?: KyselyTransaction };
