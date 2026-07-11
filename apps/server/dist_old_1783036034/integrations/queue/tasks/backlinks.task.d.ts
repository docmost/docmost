import { KyselyDB } from "../../../database/types/kysely.types";
import { BacklinkRepo } from "../../../database/repos/backlink/backlink.repo";
import { IPageBacklinkJob } from '../constants/queue.interface';
export declare function processBacklinks(db: KyselyDB, backlinkRepo: BacklinkRepo, data: IPageBacklinkJob): Promise<void>;
