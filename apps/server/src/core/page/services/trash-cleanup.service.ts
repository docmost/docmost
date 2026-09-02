import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';
import {
  assertAcyclicPageTraversal,
  PageHierarchyCycleError,
} from '../../../database/helpers/page-hierarchy-cycle';
import { sql } from 'kysely';

const DEFAULT_RETENTION_DAYS = 30;

@Injectable()
export class TrashCleanupService {
  private readonly logger = new Logger(TrashCleanupService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(QueueName.ATTACHMENT_QUEUE) private attachmentQueue: Queue,
  ) {}

  @Interval('trash-cleanup', 24 * 60 * 60 * 1000) // every 24 hours
  async cleanupOldTrash() {
    try {
      this.logger.debug('Starting trash cleanup job');

      const workspaces = await this.db
        .selectFrom('workspaces')
        .select(['id', 'trashRetentionDays'])
        .where('deletedAt', 'is', null)
        .execute();

      let totalCleaned = 0;

      for (const workspace of workspaces) {
        const retentionDays =
          workspace.trashRetentionDays ?? DEFAULT_RETENTION_DAYS;

        const retentionDate = new Date();
        retentionDate.setDate(retentionDate.getDate() - retentionDays);

        const oldDeletedPages = await this.db
          .selectFrom('pages')
          .select(['id'])
          .where('workspaceId', '=', workspace.id)
          .where('deletedAt', '<', retentionDate)
          .orderBy('id')
          .execute();

        for (const page of oldDeletedPages) {
          let pageIds: string[];

          try {
            const ancestors = await this.getPageAncestors(page.id);
            assertAcyclicPageTraversal(ancestors, page.id);

            const descendants = await this.getPageDescendants(page.id);
            assertAcyclicPageTraversal(descendants, page.id);
            pageIds = descendants.map((descendant) => descendant.id);
          } catch (error) {
            if (error instanceof PageHierarchyCycleError) {
              this.logCleanupError(page.id, error);
              continue;
            }
            throw error;
          }

          if (pageIds.length === 0) {
            continue;
          }

          try {
            totalCleaned += await this.cleanupPage(page.id, pageIds);
          } catch (error) {
            this.logCleanupError(page.id, error);
          }
        }
      }

      this.logger.debug(
        totalCleaned > 0
          ? `Trash cleanup completed: ${totalCleaned} pages cleaned`
          : 'No old trash items to clean up',
      );
    } catch (error) {
      this.logger.error(
        'Trash cleanup job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async getPageAncestors(pageId: string) {
    return this.db
      .withRecursive('page_ancestors', (db) =>
        db
          .selectFrom('pages')
          .select([
            'id',
            'parentPageId',
            sql<string[]>`ARRAY[id]::uuid[]`.as('traversalPath'),
            sql<boolean>`false`.as('isCycle'),
          ])
          .where('id', '=', pageId)
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select([
                'p.id',
                'p.parentPageId',
                sql<string[]>`pa.traversal_path || p.id`.as('traversalPath'),
                sql<boolean>`p.id = ANY(pa.traversal_path)`.as('isCycle'),
              ])
              .innerJoin('page_ancestors as pa', 'pa.parentPageId', 'p.id')
              .where('pa.isCycle', '=', false),
          ),
      )
      .selectFrom('page_ancestors')
      .select(['id', 'isCycle'])
      .execute();
  }

  private async getPageDescendants(pageId: string) {
    // Get all descendants using recursive CTE (including the page itself)
    return this.db
      .withRecursive('page_descendants', (db) =>
        db
          .selectFrom('pages')
          .select([
            'id',
            sql<string[]>`ARRAY[id]::uuid[]`.as('traversalPath'),
            sql<boolean>`false`.as('isCycle'),
          ])
          .where('id', '=', pageId)
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select([
                'p.id',
                sql<string[]>`pd.traversal_path || p.id`.as('traversalPath'),
                sql<boolean>`p.id = ANY(pd.traversal_path)`.as('isCycle'),
              ])
              .innerJoin('page_descendants as pd', 'pd.id', 'p.parentPageId')
              .where('pd.isCycle', '=', false),
          ),
      )
      .selectFrom('page_descendants')
      .select(['id', 'isCycle'])
      .execute();
  }

  private async cleanupPage(pageId: string, pageIds: string[]) {
    this.logger.debug(
      `Cleaning up page ${pageId} with ${pageIds.length - 1} descendants`,
    );

    // Queue attachment deletion for all pages with unique job IDs to prevent duplicates
    for (const id of pageIds) {
      await this.attachmentQueue.add(
        QueueJob.DELETE_PAGE_ATTACHMENTS,
        {
          pageId: id,
        },
        {
          jobId: `delete-page-attachments-${id}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );
    }

    try {
      const result = await this.db
        .deleteFrom('pages')
        .where('id', 'in', pageIds)
        .executeTakeFirst();
      return Number(result.numDeletedRows);
    } catch (error) {
      // Log but don't throw - pages might have been deleted by another node
      this.logger.warn(
        `Error deleting pages, they may have been already deleted: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return 0;
    }
  }

  private logCleanupError(pageId: string, error: unknown) {
    this.logger.error(
      `Failed to cleanup page ${pageId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}
