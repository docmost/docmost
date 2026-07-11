import { KyselyDB, KyselyTransaction } from "../../../database/types/kysely.types";
import { PageTransclusionsRepo } from "../../../database/repos/page-transclusions/page-transclusions.repo";
import { PageTransclusionReferencesRepo } from "../../../database/repos/page-transclusions/page-transclusion-references.repo";
import { PageRepo } from "../../../database/repos/page/page.repo";
import { PagePermissionRepo } from "../../../database/repos/page/page-permission.repo";
import { SpaceMemberRepo } from "../../../database/repos/space/space-member.repo";
import { AttachmentRepo } from "../../../database/repos/attachment/attachment.repo";
import { StorageService } from '../../../integrations/storage/storage.service';
import { TransclusionLookup } from './transclusion.types';
import { User } from "../../../database/types/entity.types";
import { PageAccessService } from '../page-access/page-access.service';
type ReferencingPageInfo = {
    id: string;
    slugId: string;
    title: string | null;
    icon: string | null;
    spaceId: string;
    spaceSlug: string | null;
};
export declare class TransclusionService {
    private readonly db;
    private readonly pageTransclusionsRepo;
    private readonly pageTransclusionReferencesRepo;
    private readonly pageRepo;
    private readonly pagePermissionRepo;
    private readonly spaceMemberRepo;
    private readonly attachmentRepo;
    private readonly storageService;
    private readonly pageAccessService;
    private readonly logger;
    constructor(db: KyselyDB, pageTransclusionsRepo: PageTransclusionsRepo, pageTransclusionReferencesRepo: PageTransclusionReferencesRepo, pageRepo: PageRepo, pagePermissionRepo: PagePermissionRepo, spaceMemberRepo: SpaceMemberRepo, attachmentRepo: AttachmentRepo, storageService: StorageService, pageAccessService: PageAccessService);
    syncPageTransclusions(pageId: string, workspaceId: string, pmJson: unknown, trx?: KyselyTransaction): Promise<{
        inserted: number;
        updated: number;
        deleted: number;
    }>;
    syncPageReferences(referencePageId: string, workspaceId: string, pmJson: unknown, trx?: KyselyTransaction): Promise<{
        inserted: number;
        deleted: number;
    }>;
    insertTransclusionsForPages(pages: Array<{
        id: string;
        workspaceId: string;
        content: unknown;
    }>, trx?: KyselyTransaction): Promise<{
        inserted: number;
    }>;
    insertReferencesForPages(pages: Array<{
        id: string;
        workspaceId: string;
        content: unknown;
    }>, trx?: KyselyTransaction): Promise<{
        inserted: number;
    }>;
    private filterViewerAccessiblePageIds;
    lookup(references: Array<{
        sourcePageId: string;
        transclusionId: string;
    }>, viewerUserId: string, workspaceId: string): Promise<{
        items: TransclusionLookup[];
    }>;
    lookupWithAccessSet(references: Array<{
        sourcePageId: string;
        transclusionId: string;
    }>, accessibleSet: Set<string>, workspaceId: string): Promise<{
        items: TransclusionLookup[];
    }>;
    listReferences(opts: {
        sourcePageId: string;
        transclusionId: string;
        viewerUserId: string;
        workspaceId: string;
    }): Promise<{
        source: ReferencingPageInfo | null;
        references: ReferencingPageInfo[];
    }>;
    unsyncReference(referencePageId: string, sourcePageId: string, transclusionId: string, user: User): Promise<{
        content: unknown;
    }>;
}
export {};
