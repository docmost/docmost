import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { v7 as uuid7 } from 'uuid';
import { KyselyTransaction } from '@docmost/db/types/kysely.types';
import { PageTransclusionsRepo } from '@docmost/db/repos/page-transclusions/page-transclusions.repo';
import { PageTransclusionReferencesRepo } from '@docmost/db/repos/page-transclusions/page-transclusion-references.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { StorageService } from '../../../integrations/storage/storage.service';
import {
  collectReferencesFromPmJson,
  collectTransclusionsFromPmJson,
} from './utils/transclusion-prosemirror.util';
import { rewriteAttachmentsForUnsync } from './utils/transclusion-unsync.util';
import { TransclusionLookup } from './transclusion.types';
import { Page, User } from '@docmost/db/types/entity.types';
import { PageAccessService } from '../page-access/page-access.service';

type ReferencingPageInfo = {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  spaceId: string;
  spaceSlug: string | null;
};

@Injectable()
export class TransclusionService {
  private readonly logger = new Logger(TransclusionService.name);

  constructor(
    private readonly pageTransclusionsRepo: PageTransclusionsRepo,
    private readonly pageTransclusionReferencesRepo: PageTransclusionReferencesRepo,
    private readonly pageRepo: PageRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly attachmentRepo: AttachmentRepo,
    private readonly storageService: StorageService,
    private readonly pageAccessService: PageAccessService,
  ) {}

  async syncPageTransclusions(
    pageId: string,
    workspaceId: string,
    pmJson: unknown,
    trx?: KyselyTransaction,
  ): Promise<{ inserted: number; updated: number; deleted: number }> {
    const desired = collectTransclusionsFromPmJson(pmJson);
    const desiredById = new Map(desired.map((d) => [d.transclusionId, d]));

    const existing = await this.pageTransclusionsRepo.findByPageId(pageId, trx);
    const existingById = new Map(existing.map((e) => [e.transclusionId, e]));

    let inserted = 0;
    let updated = 0;
    let deleted = 0;

    for (const d of desired) {
      const prev = existingById.get(d.transclusionId);
      if (!prev) {
        await this.pageTransclusionsRepo.insert(
          {
            workspaceId,
            pageId,
            transclusionId: d.transclusionId,
            content: d.content as any,
          },
          trx,
        );
        inserted += 1;
        continue;
      }

      const contentChanged = !isDeepStrictEqual(prev.content, d.content);
      if (contentChanged) {
        await this.pageTransclusionsRepo.update(
          pageId,
          d.transclusionId,
          { content: d.content as any },
          trx,
        );
        updated += 1;
      }
    }

    const removedIds = existing
      .filter((e) => !desiredById.has(e.transclusionId))
      .map((e) => e.transclusionId);
    if (removedIds.length > 0) {
      await this.pageTransclusionsRepo.deleteByPageAndTransclusionIds(
        pageId,
        removedIds,
        trx,
      );
      deleted = removedIds.length;
    }

    return { inserted, updated, deleted };
  }

  async syncPageReferences(
    referencePageId: string,
    workspaceId: string,
    pmJson: unknown,
    trx?: KyselyTransaction,
  ): Promise<{ inserted: number; deleted: number }> {
    const desired = collectReferencesFromPmJson(pmJson);
    const keyOf = (s: {
      sourcePageId: string;
      transclusionId: string;
    }) => `${s.sourcePageId}::${s.transclusionId}`;
    const desiredKeys = new Set(desired.map(keyOf));

    const existing = await this.pageTransclusionReferencesRepo.findByReferencePageId(
      referencePageId,
      trx,
    );
    const existingKeys = new Set(existing.map(keyOf));

    const toInsert = desired
      .filter((d) => !existingKeys.has(keyOf(d)))
      .map((d) => ({
        workspaceId,
        referencePageId,
        sourcePageId: d.sourcePageId,
        transclusionId: d.transclusionId,
      }));

    const toDelete = existing
      .filter((e) => !desiredKeys.has(keyOf(e)))
      .map((e) => ({
        sourcePageId: e.sourcePageId,
        transclusionId: e.transclusionId,
      }));

    if (toInsert.length > 0) {
      await this.pageTransclusionReferencesRepo.insertMany(toInsert, trx);
    }
    if (toDelete.length > 0) {
      await this.pageTransclusionReferencesRepo.deleteByReferenceAndKeys(
        referencePageId,
        toDelete,
        trx,
      );
    }

    return {
      inserted: toInsert.length,
      deleted: toDelete.length,
    };
  }

  /**
   * Extract transclusions from each page's PM JSON and bulk-insert into
   * `page_transclusions` in a single statement. Intended for brand-new pages
   * (e.g. duplication, import) where there is nothing to diff against.
   */
  async insertTransclusionsForPages(
    pages: Array<{ id: string; workspaceId: string; content: unknown }>,
    trx?: KyselyTransaction,
  ): Promise<{ inserted: number }> {
    const rows: Parameters<PageTransclusionsRepo['insertMany']>[0] = [];
    for (const page of pages) {
      const snapshots = collectTransclusionsFromPmJson(page.content);
      for (const s of snapshots) {
        rows.push({
          workspaceId: page.workspaceId,
          pageId: page.id,
          transclusionId: s.transclusionId,
          content: s.content as any,
        });
      }
    }
    if (rows.length === 0) return { inserted: 0 };
    await this.pageTransclusionsRepo.insertMany(rows, trx);
    return { inserted: rows.length };
  }

  /**
   * Walk each page's PM JSON for `transclusionReference` nodes and bulk-insert
   * one row per `(referencePage, source, target)`. For brand-new pages
   * (duplication, import) where there is nothing to diff against.
   */
  async insertReferencesForPages(
    pages: Array<{ id: string; workspaceId: string; content: unknown }>,
    trx?: KyselyTransaction,
  ): Promise<{ inserted: number }> {
    const rows: Array<{
      workspaceId: string;
      referencePageId: string;
      sourcePageId: string;
      transclusionId: string;
    }> = [];
    for (const page of pages) {
      const refs = collectReferencesFromPmJson(page.content);
      for (const r of refs) {
        rows.push({
          workspaceId: page.workspaceId,
          referencePageId: page.id,
          sourcePageId: r.sourcePageId,
          transclusionId: r.transclusionId,
        });
      }
    }
    if (rows.length === 0) return { inserted: 0 };
    await this.pageTransclusionReferencesRepo.insertMany(rows, trx);
    return { inserted: rows.length };
  }

  async lookup(
    references: Array<{ sourcePageId: string; transclusionId: string }>,
    viewerUserId: string,
    workspaceId: string,
  ): Promise<{ items: TransclusionLookup[] }> {
    if (references.length === 0) return { items: [] };

    const candidatePageIds = Array.from(
      new Set(references.map((r) => r.sourcePageId)),
    );
    const accessibleSet = new Set(
      await this.pagePermissionRepo.filterAccessiblePageIds({
        pageIds: candidatePageIds,
        userId: viewerUserId,
      }),
    );

    return this.lookupWithAccessSet(references, accessibleSet, workspaceId);
  }

  /**
   * Resolve transclusion content for the given references using a caller-supplied
   * `accessibleSet` of source page ids. Source pages absent from the set return
   * `no_access`. Used by the share-scoped lookup path, where access is gated by
   * the share graph rather than the viewer's personal permissions.
   */
  async lookupWithAccessSet(
    references: Array<{ sourcePageId: string; transclusionId: string }>,
    accessibleSet: Set<string>,
    workspaceId: string,
  ): Promise<{ items: TransclusionLookup[] }> {
    if (references.length === 0) return { items: [] };

    const items: TransclusionLookup[] = new Array(references.length).fill(null);
    const pendingIdx = references.map((_, i) => i);

    const accessiblePending = pendingIdx.filter((i) =>
      accessibleSet.has(references[i].sourcePageId),
    );
    const rows = await this.pageTransclusionsRepo.findManyByPageAndTransclusion(
      accessiblePending.map((i) => ({
        pageId: references[i].sourcePageId,
        transclusionId: references[i].transclusionId,
      })),
      workspaceId,
    );
    const rowKey = (r: { pageId: string; transclusionId: string }) =>
      `${r.pageId}::${r.transclusionId}`;
    const rowMap = new Map(rows.map((r) => [rowKey(r), r]));

    const accessiblePageIds = Array.from(
      new Set(accessiblePending.map((i) => references[i].sourcePageId)),
    );
    const pages = await this.pageRepo.findManyByIds(accessiblePageIds, {
      workspaceId,
    });
    const pageMeta = new Map<string, Date>();
    for (const p of pages) {
      pageMeta.set(p.id, p.updatedAt);
    }

    for (const i of pendingIdx) {
      const ref = references[i];
      if (!accessibleSet.has(ref.sourcePageId)) {
        items[i] = {
          sourcePageId: ref.sourcePageId,
          transclusionId: ref.transclusionId,
          status: 'no_access',
        };
        continue;
      }
      const updatedAt = pageMeta.get(ref.sourcePageId);
      if (!updatedAt) {
        items[i] = {
          sourcePageId: ref.sourcePageId,
          transclusionId: ref.transclusionId,
          status: 'not_found',
        };
        continue;
      }

      const row = rowMap.get(`${ref.sourcePageId}::${ref.transclusionId}`);
      if (!row) {
        items[i] = {
          sourcePageId: ref.sourcePageId,
          transclusionId: ref.transclusionId,
          status: 'not_found',
        };
        continue;
      }
      items[i] = {
        sourcePageId: ref.sourcePageId,
        transclusionId: ref.transclusionId,
        content: row.content,
        sourceUpdatedAt: updatedAt,
      };
    }

    return { items };
  }

  async listReferences(opts: {
    sourcePageId: string;
    transclusionId: string;
    viewerUserId: string;
    workspaceId: string;
  }): Promise<{
    source: ReferencingPageInfo | null;
    references: ReferencingPageInfo[];
  }> {
    const { sourcePageId, transclusionId, viewerUserId, workspaceId } = opts;

    const referencePageIds =
      await this.pageTransclusionReferencesRepo.findReferencePageIdsByTransclusion(
        sourcePageId,
        transclusionId,
        workspaceId,
      );

    const candidatePageIds = Array.from(
      new Set([sourcePageId, ...referencePageIds]),
    );
    const accessibleSet = new Set(
      await this.pagePermissionRepo.filterAccessiblePageIds({
        pageIds: candidatePageIds,
        userId: viewerUserId,
      }),
    );

    const accessibleIds = candidatePageIds.filter((id) =>
      accessibleSet.has(id),
    );
    if (accessibleIds.length === 0) {
      return { source: null, references: [] };
    }

    const rows = await Promise.all(
      accessibleIds.map((id) =>
        this.pageRepo.findById(id, { includeSpace: true }),
      ),
    );
    const byId = new Map<string, ReferencingPageInfo>();
    for (const p of rows) {
      if (!p || p.deletedAt || p.workspaceId !== workspaceId) continue;
      const space = (p as Page & { space?: { slug?: string } }).space;
      byId.set(p.id, {
        id: p.id,
        slugId: p.slugId,
        title: p.title ?? null,
        icon: p.icon ?? null,
        spaceId: p.spaceId,
        spaceSlug: space?.slug ?? null,
      });
    }

    const source = byId.get(sourcePageId) ?? null;
    const references = referencePageIds
      .map((id) => byId.get(id))
      .filter((p): p is ReferencingPageInfo => Boolean(p));

    return { source, references };
  }

  /**
   * Convert a `transclusionReference` into a self-contained copy on the
   * reference page: load source content, generate fresh attachment ids, copy storage
   * files, insert new attachment rows, return rewritten content. The caller
   * (controller) returns the content blob to the client which then performs
   * `editor.commands.insertContentAt(range, content)` to replace the
   * reference node. The next Yjs save naturally cleans up the
   * page_transclusion_references row, but we also delete it eagerly here so a
   * crash between server response and client save doesn't leave a stale row.
   */
  async unsyncReference(
    referencePageId: string,
    sourcePageId: string,
    transclusionId: string,
    user: User,
  ): Promise<{ content: unknown }> {
    const referencePage = await this.pageRepo.findById(referencePageId);
    if (!referencePage || referencePage.deletedAt) {
      throw new NotFoundException('Reference page not found');
    }

    const sourcePage = await this.pageRepo.findById(sourcePageId);
    if (!sourcePage || sourcePage.deletedAt) {
      throw new NotFoundException('Source page not found');
    }

    if (
      referencePage.workspaceId !== user.workspaceId ||
      sourcePage.workspaceId !== user.workspaceId
    ) {
      throw new ForbiddenException();
    }

    await this.pageAccessService.validateCanEdit(referencePage, user);
    await this.pageAccessService.validateCanView(sourcePage, user);

    const transclusion =
      await this.pageTransclusionsRepo.findByPageAndTransclusion(
        sourcePageId,
        transclusionId,
      );
    if (!transclusion) {
      throw new NotFoundException('Sync block not found');
    }

    const { content, copies } = rewriteAttachmentsForUnsync(
      transclusion.content,
      () => uuid7(),
    );

    if (copies.length > 0) {
      const oldIds = copies.map((c) => c.oldAttachmentId);
      const oldRows = await this.attachmentRepo.findByIds(oldIds);
      const byOldId = new Map(
        oldRows
          .filter((a) => a.pageId === sourcePageId)
          .map((a) => [a.id, a]),
      );

      for (const plan of copies) {
        const old = byOldId.get(plan.oldAttachmentId);
        if (!old) continue;

        const newFilePath = old.filePath
          .split(plan.oldAttachmentId)
          .join(plan.newAttachmentId);
        try {
          await this.storageService.copy(old.filePath, newFilePath);
        } catch (err) {
          this.logger.error(
            `unsync: failed to copy attachment ${old.id}`,
            err as Error,
          );
          continue;
        }
        await this.attachmentRepo.insertAttachment({
          id: plan.newAttachmentId,
          type: old.type,
          filePath: newFilePath,
          fileName: old.fileName,
          fileSize: old.fileSize,
          mimeType: old.mimeType,
          fileExt: old.fileExt,
          creatorId: user.id,
          workspaceId: referencePage.workspaceId,
          pageId: referencePageId,
          spaceId: referencePage.spaceId,
        });
      }
    }

    await this.pageTransclusionReferencesRepo.deleteOne(
      referencePageId,
      sourcePageId,
      transclusionId,
    );

    return { content };
  }
}
