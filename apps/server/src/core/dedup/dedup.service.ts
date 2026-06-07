import { BadRequestException, Injectable } from '@nestjs/common';
import { DedupRepo } from '@docmost/db/repos/dedup/dedup.repo';
import { contentHash } from './dedup.util';

export interface DedupClusterPage {
  pageId: string;
  title: string | null;
  slugId: string;
  spaceId: string;
}

export interface DedupCluster {
  sha256: string;
  charLen: number;
  pages: DedupClusterPage[];
  // recommendation: keep the oldest page, drop the rest
  recommendation: { keepPageId: string; dropPageIds: string[] };
}

export interface DedupAnalysis {
  scanned: number;
  duplicateClusters: number;
  clusters: DedupCluster[];
}

@Injectable()
export class DedupService {
  constructor(private readonly dedupRepo: DedupRepo) {}

  /**
   * Computes a normalized content hash for every (non-empty) page in scope,
   * persists it, and returns clusters of pages that share a hash (exact dups).
   * The agent decides what to merge — this is read-only analysis.
   */
  async analyze(workspaceId: string, spaceId?: string): Promise<DedupAnalysis> {
    const pages = await this.dedupRepo.listPagesForHashing(
      workspaceId,
      spaceId,
    );

    const byHash = new Map<
      string,
      { charLen: number; pages: (DedupClusterPage & { createdAt: Date })[] }
    >();

    let scanned = 0;
    for (const page of pages) {
      const normalizedLen = (page.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim().length;
      // skip empty pages — every blank page would otherwise collide
      if (normalizedLen === 0) continue;

      const sha256 = contentHash(page.textContent);
      await this.dedupRepo.upsertHash(
        page.id,
        workspaceId,
        sha256,
        normalizedLen,
      );
      scanned += 1;

      const bucket = byHash.get(sha256) ?? { charLen: normalizedLen, pages: [] };
      bucket.pages.push({
        pageId: page.id,
        title: page.title,
        slugId: page.slugId,
        spaceId: page.spaceId,
        createdAt: page.createdAt,
      });
      byHash.set(sha256, bucket);
    }

    const clusters: DedupCluster[] = [];
    for (const [sha256, bucket] of byHash) {
      if (bucket.pages.length < 2) continue;
      const ordered = [...bucket.pages].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const keep = ordered[0];
      clusters.push({
        sha256,
        charLen: bucket.charLen,
        pages: ordered.map(({ createdAt: _createdAt, ...p }) => p),
        recommendation: {
          keepPageId: keep.pageId,
          dropPageIds: ordered.slice(1).map((p) => p.pageId),
        },
      });
    }

    return {
      scanned,
      duplicateClusters: clusters.length,
      clusters,
    };
  }

  /** Validates a resolve request; the controller performs the soft-deletes. */
  assertResolvable(keepPageId: string, dropPageIds: string[]): void {
    if (dropPageIds.includes(keepPageId)) {
      throw new BadRequestException(
        'keepPageId cannot also be in dropPageIds',
      );
    }
  }
}
