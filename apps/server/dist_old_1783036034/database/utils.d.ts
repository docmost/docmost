import { KyselyDB, KyselyTransaction } from './types/kysely.types';
export declare function executeTx<T>(db: KyselyDB, callback: (trx: KyselyTransaction) => Promise<T>, existingTrx?: KyselyTransaction): Promise<T>;
export declare function dbOrTx(db: KyselyDB, existingTrx?: KyselyTransaction): KyselyDB | KyselyTransaction;
