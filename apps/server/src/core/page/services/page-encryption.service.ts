import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { Page, User } from '@docmost/db/types/entity.types';
import { executeTx } from '@docmost/db/utils';
import { nanoIdGen } from '../../../common/helpers';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventName } from '../../../common/events/event.contants';
import {
  ConvertToDecryptedDto,
  ConvertToEncryptedDto,
  RewrapEncryptionKeyDto,
  UpdateEncryptedPageDto,
} from '../dto/page-encryption.dto';
import { createYdocFromJson } from '../../../common/helpers/prosemirror/utils';
import { jsonToNode, jsonToText } from 'src/collaboration/collaboration.util';
import { CollaborationGateway } from '../../../collaboration/collaboration.gateway';
import { E2eeRelayService } from '../../../collaboration/e2ee/e2ee-relay.service';
import { sql } from 'kysely';
import { HISTORY_INTERVAL } from '../../../collaboration/constants';
import {
  encryptionRootIdOf,
  MAX_ENCRYPTED_TREE_PAGES,
  staleSnapshotPageId,
  staleVersionPageId,
} from '../page-encryption.util';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  QueueJob,
  QueueName,
} from '../../../integrations/queue/constants';

/** what a conversion destroyed, per table (see convertToEncrypted) */
export interface DeletedOnEncryption {
  history: number;
  backlinks: number;
  transclusions: number;
  shares: number;
  comments: number;
  /** files that lived on the pages; storage is queued for deletion after the TX */
  attachments: number;
}

export interface ConvertToEncryptedResult {
  pageCount: number;
  deleted: DeletedOnEncryption;
}

@Injectable()
export class PageEncryptionService {
  private readonly logger = new Logger(PageEncryptionService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pageRepo: PageRepo,
    private readonly pageHistoryRepo: PageHistoryRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private eventEmitter: EventEmitter2,
    private readonly collaborationGateway: CollaborationGateway,
    private readonly e2eeRelayService: E2eeRelayService,
    private readonly spaceAbility: SpaceAbilityFactory,
    @InjectQueue(QueueName.ATTACHMENT_QUEUE) private attachmentQueue: Queue,
  ) {}

  /**
   * Converting a section rewrites every page in it, so partial access is not
   * enough: a page the user cannot edit would either be skipped (leaving
   * plaintext behind in an "encrypted" section) or rewritten without
   * permission. Both are wrong, so the whole section is refused instead.
   */
  private async assertCanEditWholeSection(
    pageIds: string[],
    user: User,
    spaceId: string,
  ) {
    // filterAccessiblePageIdsWithPermissions returns canEdit = true for any
    // page with no restricted ancestor — it defers the decision to the space.
    // Every other caller ANDs it with the space-level Edit ability, and so
    // must this one: otherwise a page-level writer on a restricted root could
    // rewrite the whole unrestricted subtree without space edit rights.
    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException(
        'You need edit access to every page in this section to change its encryption.',
      );
    }

    const permissions =
      await this.pagePermissionRepo.filterAccessiblePageIdsWithPermissions(
        pageIds,
        user.id,
      );

    const editableIds = new Set(
      permissions.filter((p) => p.canEdit).map((p) => p.id),
    );

    if (pageIds.some((id) => !editableIds.has(id))) {
      throw new ForbiddenException(
        'You need edit access to every page in this section to change its encryption.',
      );
    }
  }

  /**
   * The pages the client must encrypt (or decrypt) to convert this section,
   * with the plaintext content it needs to encrypt them.
   */
  async getSectionManifest(page: Page, user: User) {
    if (page.isEncrypted) {
      if (page.encryptionRootId) {
        throw new BadRequestException(
          'This page belongs to an encrypted section; use its root page',
        );
      }

      const pages = await this.db
        .selectFrom('pages')
        .select(['id', 'title', 'encryptedBlob', 'encryptedVersion'])
        .where((eb) =>
          eb.or([
            eb('id', '=', page.id),
            eb('encryptionRootId', '=', page.id),
          ]),
        )
        .execute();

      await this.assertCanEditWholeSection(
        pages.map((p) => p.id),
        user,
        page.spaceId,
      );

      return {
        kind: 'encrypted' as const,
        pages: pages.map((p) => ({
          pageId: p.id,
          title: p.title,
          encryptedBlob: p.encryptedBlob
            ? Buffer.from(p.encryptedBlob).toString('base64')
            : null,
          version: Number(p.encryptedVersion),
        })),
      };
    }

    // Load structure first so we can freeze collab before reading content.
    // Concurrent editors would otherwise keep writing after the client
    // snapshots, and convert would discard those edits with the plaintext.
    const structure = await this.loadConvertibleSubtree(page.id, {
      includeContent: false,
    });

    await this.assertCanEditWholeSection(
      structure.map((p) => p.id),
      user,
      page.spaceId,
    );

    await this.closePlaintextCollab(structure.map((p) => p.id));

    const subtree = await this.loadConvertibleSubtree(page.id, {
      includeContent: true,
    });

    return {
      kind: 'plaintext' as const,
      pages: subtree.map((p) => ({
        pageId: p.id,
        title: p.title,
        content: p.content,
        // Echoed back by the conversion request and compared under the row
        // locks: kicked collab clients can reconnect while the user types the
        // passphrase (the pages are still plaintext), and their edits would
        // otherwise be silently overwritten by ciphertext of this snapshot.
        updatedAt: p.updatedAt,
      })),
    };
  }

  /** Kick plaintext collab so a conversion snapshot is not racing live edits. */
  private async closePlaintextCollab(pageIds: string[]): Promise<void> {
    await Promise.all(
      pageIds.map((pageId) =>
        this.collaborationGateway
          .closeDocumentConnections(`page.${pageId}`)
          .catch((err) =>
            this.logger.warn(
              `Failed to close collab connections before encrypting page ${pageId}`,
              err,
            ),
          ),
      ),
    );
  }

  /**
   * Lock every page of the set the client encrypted, then re-derive that set
   * under the lock and require it to be identical.
   *
   * A conversion is agreed with the client outside the transaction (it holds
   * the keys, so it must produce the ciphertext first). Between that agreement
   * and the write, a page can be created, moved in, or moved out — which would
   * leave plaintext inside an encrypted section, or a page keyed to a root
   * that is about to lose its DEK. Taking the row locks first means a
   * concurrent create/move on these pages must wait, and re-deriving the set
   * afterwards catches anything that got in before the locks.
   *
   * `createPage` and `movePage` take the same row locks, which is what makes
   * this airtight rather than merely narrow.
   */
  private async lockAndVerifySection(
    trx: KyselyTransaction,
    expectedPageIds: string[],
    expectedSpaceId: string,
    rederive: (trx: KyselyTransaction) => Promise<string[]>,
    conflictMessage: string,
    // rows to lock and space-check alongside the section without taking part
    // in the set comparison — the join target, for instance. Locked in the
    // same statement: a second forUpdate would reintroduce the two-phase
    // acquisition this fixed ordering exists to prevent.
    extraLockIds: string[] = [],
  ) {
    // updatedAt and encryptedVersion ride along for the callers' freshness
    // checks — reading them in the same statement that takes the locks means
    // there is no window for them to go stale afterwards
    const locked = await trx
      .selectFrom('pages')
      .select(['id', 'spaceId', 'updatedAt', 'encryptedVersion'])
      .where('id', 'in', [...new Set([...expectedPageIds, ...extraLockIds])])
      // Deterministic lock order. Without it the planner decides, and two
      // transactions locking overlapping page sets can each hold what the other
      // wants; Postgres then aborts one with a deadlock error. Ordering by id
      // means every caller takes the same rows in the same sequence.
      .orderBy('id')
      .forUpdate()
      .execute();

    // A move to another space keeps ids and parent links intact, so the set
    // re-derivation below cannot see it — but converting the pages anyway
    // would key them to a root the new space cannot reach. movePageToSpace
    // locks these same rows, so by the time this lock is granted the spaceId
    // it wrote is visible here.
    if (locked.some((p) => p.spaceId !== expectedSpaceId)) {
      throw new ConflictException(conflictMessage);
    }

    const actual = await rederive(trx);
    const expected = new Set(expectedPageIds);

    if (
      actual.length !== expectedPageIds.length ||
      actual.some((id) => !expected.has(id))
    ) {
      throw new ConflictException(conflictMessage);
    }

    return locked;
  }

  /** ids of a page and all its descendants, read inside a transaction */
  private async descendantIdsInTx(
    trx: KyselyTransaction,
    pageId: string,
  ): Promise<string[]> {
    const rows = await trx
      .withRecursive('subtree', (db) =>
        db
          .selectFrom('pages')
          .select('id')
          .where('id', '=', pageId)
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select('p.id')
              .innerJoin('subtree as s', 'p.parentPageId', 's.id'),
          ),
      )
      .selectFrom('subtree')
      .select('id')
      .execute();

    return rows.map((r) => r.id);
  }

  /** ids of a section's root plus every page keyed to it, inside a transaction */
  private async keyedPageIdsInTx(
    trx: KyselyTransaction,
    rootPageId: string,
  ): Promise<string[]> {
    const rows = await trx
      .selectFrom('pages')
      .select('id')
      .where((eb) =>
        eb.or([
          eb('id', '=', rootPageId),
          eb('encryptionRootId', '=', rootPageId),
        ]),
      )
      .execute();

    return rows.map((r) => r.id);
  }

  /**
   * The subtree a conversion would cover, rejected up front if it is too big
   * to convert in one transaction or already contains encrypted pages.
   * Shared by the manifest and the conversion so the two cannot drift.
   */
  private async loadConvertibleSubtree(
    pageId: string,
    opts: { includeContent: boolean },
  ) {
    const subtree = await this.pageRepo.getPageAndDescendants(pageId, {
      ...opts,
      // a trashed page is still part of the section: leaving it in plaintext
      // would defeat the encryption the moment it is restored
      includeDeleted: true,
    });

    if (subtree.length > MAX_ENCRYPTED_TREE_PAGES) {
      throw new BadRequestException(
        `Cannot encrypt more than ${MAX_ENCRYPTED_TREE_PAGES} pages at once. Move some pages out of this section first.`,
      );
    }

    if (subtree.some((p) => p.isEncrypted)) {
      throw new BadRequestException(
        'This section already contains encrypted pages',
      );
    }

    return subtree;
  }

  /** key metadata for a page, read from its encryption root */
  async getSectionEncryptionMeta(page: Page) {
    if (!page.encryptionRootId) return page.encryptionMeta;

    const root = await this.db
      .selectFrom('pages')
      .select(['isEncrypted', 'encryptionMeta'])
      .where('id', '=', page.encryptionRootId)
      .executeTakeFirst();

    if (!root?.isEncrypted || !root.encryptionMeta) {
      throw new NotFoundException('Encryption key for this page is missing');
    }
    return root.encryptionMeta;
  }

  async getEncryptedBlob(page: Page) {
    if (!page.isEncrypted) {
      throw new BadRequestException('Page is not encrypted');
    }

    const withBlob = await this.pageRepo.findById(page.id, {
      includeEncryptedBlob: true,
    });

    return {
      pageId: page.id,
      encryptionRootId: encryptionRootIdOf(withBlob),
      encryptionMeta: await this.getSectionEncryptionMeta(withBlob),
      encryptedBlob: withBlob.encryptedBlob
        ? Buffer.from(withBlob.encryptedBlob).toString('base64')
        : null,
      version: Number(withBlob.encryptedVersion),
    };
  }

  /**
   * Turn a plaintext page and its entire subtree into E2E-encrypted pages
   * sharing one DEK. The client sends the already-encrypted blob for every
   * page plus the key metadata; every plaintext trace (content, text_content,
   * ydoc, history, backlinks, transclusions) is removed in the same
   * transaction.
   *
   * The root stores the key metadata; descendants only point at it via
   * encryption_root_id, so a password change re-wraps a single row.
   */
  async convertToEncrypted(
    page: Page,
    dto: ConvertToEncryptedDto,
    user: User,
  ): Promise<ConvertToEncryptedResult> {
    if (page.isEncrypted) {
      throw new BadRequestException('Page is already encrypted');
    }

    if (Boolean(dto.encryptionMeta) === Boolean(dto.encryptionRootId)) {
      throw new BadRequestException(
        'A conversion must either start an encrypted section or join one',
      );
    }

    // Starting a section under an existing one would nest two DEKs — the same
    // thing assertEncryptionMoveAllowed refuses for a move. It should be
    // unreachable (a plaintext page under an encrypted parent is exactly what
    // the invariants forbid) but this is the other way in, so it is checked.
    if (dto.encryptionMeta && page.parentPageId) {
      const parent = await this.pageRepo.findById(page.parentPageId);
      if (parent && !parent.deletedAt && encryptionRootIdOf(parent)) {
        throw new BadRequestException({
          code: 'ENCRYPTED_SECTION_NESTING',
          message: 'An encrypted section cannot be nested inside another one.',
        });
      }
    }

    // joining an existing section: validate the target key holder, and that
    // the requested destination really sits inside that section
    let joinRoot: Page = null;
    // Resolved from the request, which may name the destination by slug id.
    // Everything downstream writes and compares real ids, so it must go
    // through this rather than re-reading dto.move.parentPageId — a slug would
    // slip past the cycle check and then fail as a foreign-key violation.
    let joinDestination: Page = null;
    if (dto.encryptionRootId) {
      if (!dto.move) {
        throw new BadRequestException(
          'Joining an encrypted section requires a destination',
        );
      }

      // the same position check movePage does — this path writes `position`
      // directly, so it must not accept a key movePage would have rejected
      try {
        generateJitteredKeyBetween(dto.move.position, null);
      } catch (err) {
        throw new BadRequestException('Invalid move position');
      }

      const [root, destination] = await Promise.all([
        this.pageRepo.findById(dto.encryptionRootId),
        this.pageRepo.findById(dto.move.parentPageId),
      ]);

      if (
        !root ||
        root.deletedAt ||
        !root.isEncrypted ||
        root.encryptionRootId ||
        root.spaceId !== page.spaceId
      ) {
        throw new BadRequestException('Encrypted section not found');
      }

      if (
        !destination ||
        destination.deletedAt ||
        encryptionRootIdOf(destination) !== root.id
      ) {
        throw new BadRequestException(
          'The destination is not inside that encrypted section',
        );
      }

      joinRoot = root;
      joinDestination = destination;
    } else if (dto.move) {
      throw new BadRequestException(
        'A move is only allowed when joining an encrypted section',
      );
    }

    const subtree = await this.loadConvertibleSubtree(page.id, {
      includeContent: false,
    });

    // The client encrypted a snapshot of the tree; if it no longer matches,
    // some page would be left behind in plaintext (or have no ciphertext).
    const blobs = new Map<string, string>([[page.id, dto.encryptedBlob]]);
    // manifest updatedAt per page, checked under lock alongside the id set:
    // the id set catches structural drift, this catches content edits made
    // between the manifest and the conversion write (the pages are still
    // plaintext then, so kicked collab clients can reconnect and keep editing
    // while the client encrypts the subtree)
    const snapshots = new Map<string, number>([
      [page.id, new Date(dto.snapshotUpdatedAt).getTime()],
    ]);
    for (const descendant of dto.descendants ?? []) {
      blobs.set(descendant.pageId, descendant.encryptedBlob);
      snapshots.set(
        descendant.pageId,
        new Date(descendant.snapshotUpdatedAt).getTime(),
      );
    }

    const pageIds = subtree.map((p) => p.id);
    if (blobs.size !== pageIds.length || pageIds.some((id) => !blobs.has(id))) {
      throw new ConflictException(
        'This section changed while it was being encrypted. Reload and try again.',
      );
    }

    // Cannot happen today (the destination is encrypted and this subtree is
    // all plaintext, so they are disjoint) but this write sets parentPageId
    // directly, and a cycle would detach the subtree from the tree entirely.
    if (joinDestination && pageIds.includes(joinDestination.id)) {
      throw new BadRequestException(
        'Cannot move a page inside one of its own sub-pages',
      );
    }

    // the pages being converted, plus — when joining — the section being
    // written into: edit rights on the dragged page alone must not be enough
    // to push pages into a section the user may only read
    await this.assertCanEditWholeSection(
      joinRoot ? [...pageIds, joinRoot.id, joinDestination.id] : pageIds,
      user,
      page.spaceId,
    );

    let deleted: DeletedOnEncryption;
    await executeTx(this.db, async (trx) => {
      const lockedRows = await this.lockAndVerifySection(
        trx,
        pageIds,
        page.spaceId,
        (tx) => this.descendantIdsInTx(tx, page.id),
        'This section changed while it was being encrypted. Reload and try again.',
        // locked together with the subtree in one ordered statement — locking
        // them in a second statement here could interleave with a transaction
        // (movePageToSpace) that locks a superset in one pass, and deadlock
        joinRoot ? [joinRoot.id, joinDestination.id] : [],
      );

      // The ciphertext encodes the manifest's snapshot of each page. An edit
      // that landed since (a reconnected collab client, a concurrent API
      // save) bumped updatedAt; overwriting it would silently destroy the
      // edit, and the history purge below makes that unrecoverable — so the
      // conversion is refused instead and the client retries from a fresh
      // manifest. The rows come from the locking statement itself, so the
      // values cannot be staler than the locks.
      if (staleSnapshotPageId(lockedRows, snapshots)) {
        throw new ConflictException(
          'This section changed while it was being encrypted. Reload and try again.',
        );
      }

      if (joinRoot) {
        // Re-check under the row locks taken above: between the validation
        // outside the transaction and this write the section could have been
        // decrypted, or the destination could have been moved or deleted out
        // of it — either would key these pages to a root their new location
        // cannot reach.
        const locked = await trx
          .selectFrom('pages')
          .select([
            'id',
            'spaceId',
            'isEncrypted',
            'encryptionRootId',
            'encryptionMeta',
            'deletedAt',
          ])
          .where('id', 'in', [joinRoot.id, joinDestination.id])
          .execute();

        const root = locked.find((p) => p.id === joinRoot.id);
        const destination = locked.find((p) => p.id === joinDestination.id);

        // These pages are being added to a section that already has pages of
        // its own. The incoming subtree is capped on its own, but the *result*
        // is what a future decrypt has to carry in one request — so the
        // combined size is what matters. Same helper as create and duplicate,
        // so the three cannot drift apart.
        await this.pageRepo.assertSectionHasRoom(
          joinRoot.id,
          pageIds.length,
          trx,
        );

        if (
          !root?.isEncrypted ||
          root.encryptionRootId ||
          !root.encryptionMeta ||
          root.deletedAt ||
          // a concurrent movePageToSpace of the section keeps it intact but
          // relocates it — joining across spaces would cross-link the trees
          root.spaceId !== page.spaceId ||
          !destination ||
          destination.deletedAt ||
          destination.spaceId !== page.spaceId ||
          encryptionRootIdOf(destination as any) !== joinRoot.id
        ) {
          throw new ConflictException(
            'That encrypted section changed while these pages were being encrypted. Reload and try again.',
          );
        }
      }

      // One statement for the whole subtree: a per-page UPDATE would hold row
      // locks across up to MAX_ENCRYPTED_TREE_PAGES round trips.
      const rows = pageIds.map((pageId) => {
        // when joining a section every page is keyed to it, the dragged page
        // included; when starting one the dragged page becomes the key holder
        const isNewRoot = !joinRoot && pageId === page.id;
        const isMovedPage = pageId === page.id;
        return sql`(
          ${pageId}::uuid,
          ${
            isNewRoot ? JSON.stringify(dto.encryptionMeta) : null
          }::text::jsonb,
          ${isNewRoot ? user.id : null}::uuid,
          ${isNewRoot ? null : (joinRoot?.id ?? page.id)}::uuid,
          ${Buffer.from(blobs.get(pageId), 'base64')}::bytea,
          ${joinDestination && isMovedPage ? joinDestination.id : null}::uuid,
          ${joinDestination && isMovedPage ? dto.move.position : null}::varchar
        )`;
      });

      const updated = await sql<{ id: string }>`
        UPDATE pages SET
          is_encrypted = true,
          encryption_meta = v.encryption_meta,
          encrypted_by_id = v.encrypted_by_id,
          encryption_root_id = v.encryption_root_id,
          encrypted_blob = v.encrypted_blob,
          encrypted_version = 1,
          content = NULL,
          text_content = NULL,
          ydoc = NULL,
          last_updated_by_id = ${user.id}::uuid,
          updated_at = NOW(),
          -- a drag into a section converts and relocates in one write; every
          -- other row keeps the parent and position it already had
          parent_page_id = COALESCE(v.parent_page_id, pages.parent_page_id),
          position = COALESCE(v.position, pages.position)
        FROM (VALUES ${sql.join(rows)}) AS v(
          id, encryption_meta, encrypted_by_id, encryption_root_id,
          encrypted_blob, parent_page_id, position
        )
        WHERE pages.id = v.id AND pages.is_encrypted = false
        RETURNING pages.id
      `.execute(trx);

      if (updated.rows.length !== pageIds.length) {
        // someone converted (or deleted) a page concurrently — abort so the
        // side-effect deletes below never run against the wrong state
        throw new ConflictException(
          'This section changed while it was being encrypted. Reload and try again.',
        );
      }

      // Data the server cannot re-encrypt, and therefore cannot keep. The
      // counts are reported back and recorded in the audit entry: this is not
      // recoverable from the trash, so "what was destroyed" must be visible
      // afterwards rather than implied by the conversion.
      const countOf = (result: { numDeletedRows: bigint }[]) =>
        Number(result[0]?.numDeletedRows ?? 0);

      // plaintext snapshots must not survive the conversion
      const history = countOf(
        await trx.deleteFrom('pageHistory').where('pageId', 'in', pageIds).execute(),
      );

      // link graph edges in either direction; inbound links still name
      // encrypted pages after convert and must not linger as server-side
      // relationship metadata derived from the old plaintext
      const backlinks = countOf(
        await trx
          .deleteFrom('backlinks')
          .where((eb) =>
            eb.or([
              eb('sourcePageId', 'in', pageIds),
              eb('targetPageId', 'in', pageIds),
            ]),
          )
          .execute(),
      );
      const transclusions = countOf(
        await trx
          .deleteFrom('pageTransclusions')
          .where('pageId', 'in', pageIds)
          .execute(),
      );
      // both sides of a transclusion reference: a source embed or a target
      // that lives in this section
      await trx
        .deleteFrom('pageTransclusionReferences')
        .where((eb) =>
          eb.or([
            eb('sourcePageId', 'in', pageIds),
            eb('referencePageId', 'in', pageIds),
          ]),
        )
        .execute();

      // an encrypted page cannot be publicly shared
      const shares = countOf(
        await trx.deleteFrom('shares').where('pageId', 'in', pageIds).execute(),
      );

      // comments may quote page content; they must not survive either
      const comments = countOf(
        await trx.deleteFrom('comments').where('pageId', 'in', pageIds).execute(),
      );

      // Attachments are stored outside the page encryption envelope. Leaving
      // them would publish files the page now implies are protected. Count
      // here; storage + row deletion is queued after commit (same path as
      // force-delete) so a failed TX never loses files.
      const attachmentCountRow = await trx
        .selectFrom('attachments')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('pageId', 'in', pageIds)
        .executeTakeFirst();
      const attachments = Number(attachmentCountRow?.count ?? 0);

      deleted = {
        history,
        backlinks,
        transclusions,
        shares,
        comments,
        attachments,
      };
    });

    // Storage deletion is async; downloads for encrypted pages are also
    // refused at the attachment controller so residual rows cannot be served.
    if (deleted.attachments > 0) {
      // The attachment queue retains completed jobs (removeOnComplete count),
      // and BullMQ dedups on jobId against retained jobs. A page can be
      // encrypted, decrypted, and encrypted again, so a static per-page id
      // would silently drop every purge after the first — suffix a nonce.
      const purgeNonce = nanoIdGen();
      for (const id of pageIds) {
        await this.attachmentQueue.add(
          QueueJob.DELETE_PAGE_ATTACHMENTS,
          { pageId: id },
          {
            jobId: `delete-page-attachments-encrypt-${id}-${purgeNonce}`,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
        );
      }
    }

    // kick every live collaboration session off the now-encrypted documents
    // so no plaintext ydoc lingers in collab server memory
    await Promise.all(
      pageIds.map((pageId) =>
        this.collaborationGateway
          .closeDocumentConnections(`page.${pageId}`)
          .catch((err) =>
            this.logger.warn(
              `Failed to close collab connections for encrypted page ${pageId}`,
              err,
            ),
          ),
      ),
    );

    // Purges these pages from the search index and any AI embeddings: their
    // plaintext was indexed while they were readable and is still sitting
    // there. Deliberately the *only* event emitted here — PAGE_UPDATED would
    // queue a reindex of the same pages, racing this removal and potentially
    // putting them back.
    this.eventEmitter.emit(EventName.PAGE_ENCRYPTED, {
      pageIds,
      workspaceId: page.workspaceId,
    });

    return { pageCount: pageIds.length, deleted };
  }

  /**
   * Save a new ciphertext for an encrypted page with optimistic locking:
   * the write only succeeds if the client's baseVersion matches the stored
   * version, otherwise another client saved first and we return 409.
   *
   * Note the page write and the history snapshot are deliberately NOT one
   * transaction: the snapshot is best-effort and must never be able to fail
   * the save (nor hold the page row's lock for the length of the history
   * insert). The crash window is therefore "page updated, snapshot missing" —
   * benign, since the next eligible save snapshots the newer ciphertext. The
   * inverse (snapshot without page update) cannot happen: the insert only
   * runs after the update has committed.
   */
  async updateEncrypted(
    page: Page,
    dto: UpdateEncryptedPageDto,
    user: User,
  ): Promise<{
    version: number;
    nextSnapshotInMs?: number;
    snapshotSaved?: boolean;
  }> {
    if (!page.isEncrypted) {
      throw new BadRequestException('Page is not encrypted');
    }

    const contributors = new Set<string>(page.contributorIds);
    contributors.add(user.id);
    const contributorIds = Array.from(contributors);

    const newVersion = dto.baseVersion + 1;
    const encryptedBlob = Buffer.from(dto.encryptedBlob, 'base64');

    const result = await this.db
      .updateTable('pages')
      .set({
        encryptedBlob,
        encryptedVersion: String(newVersion),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        lastUpdatedById: user.id,
        contributorIds,
        updatedAt: new Date(),
      })
      .where('id', '=', page.id)
      .where('isEncrypted', '=', true)
      .where('encryptedVersion', '=', String(dto.baseVersion))
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) === 0) {
      throw new ConflictException(
        'The page was modified by someone else. Reload before saving again.',
      );
    }

    // A failed snapshot must not fail the save — the document itself is
    // already stored, and the next save will snapshot instead.
    let nextSnapshotInMs: number | undefined;
    let snapshotSaved: boolean | undefined;
    if (dto.saveHistory) {
      try {
        ({ nextSnapshotInMs, snapshotSaved } =
          await this.pageHistoryRepo.saveEncryptedHistory(page, {
            encryptedBlob,
            version: newVersion,
            title: dto.title ?? page.title,
            lastUpdatedById: user.id,
            contributorIds,
          }));
      } catch (err) {
        this.logger.error('Failed to save encrypted page history', err);
        // back the client off instead of letting it ask for a snapshot on
        // every subsequent save while whatever broke here is still broken
        nextSnapshotInMs = HISTORY_INTERVAL;
        snapshotSaved = false;
      }
    }

    this.eventEmitter.emit(EventName.PAGE_UPDATED, {
      pageIds: [page.id],
      workspaceId: page.workspaceId,
    });

    return { version: newVersion, nextSnapshotInMs, snapshotSaved };
  }

  /**
   * Gate for the two operations that can destroy an encrypted section outright
   * — replacing its key, and replacing its ciphertext with plaintext.
   *
   * Both are irreversible in a way deleting a page is not: there is no trash to
   * restore from, and the server can never prove that the caller actually holds
   * the DEK (it has never seen a key). Edit rights are therefore not enough;
   * this is limited to whoever encrypted the section, or someone who
   * administers the space it lives in.
   */
  private async assertCanManageSectionKey(
    page: Page,
    user: User,
  ): Promise<void> {
    // Whoever set the password, not whoever created the page: anyone with edit
    // rights can encrypt a page someone else wrote, and the original author may
    // never have known the password. Falls back to the creator only for
    // sections encrypted before this was recorded.
    const owner = page.encryptedById ?? page.creatorId;
    if (owner === user.id) {
      return;
    }
    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException(
        'Only the person who encrypted this section, or a space admin, can change or remove its encryption',
      );
    }
  }

  /**
   * Password change: replace the key metadata (re-wrapped DEK). The
   * ciphertext itself is unchanged.
   */
  async rewrapKey(
    page: Page,
    dto: RewrapEncryptionKeyDto,
    user: User,
  ): Promise<void> {
    if (!page.isEncrypted) {
      throw new BadRequestException('Page is not encrypted');
    }

    if (page.encryptionRootId) {
      throw new BadRequestException(
        'The password is managed by the encrypted section this page belongs to',
      );
    }

    await this.assertCanManageSectionKey(page, user);

    // Compare-and-swap on the current wrappedDek: prevents concurrent rewraps
    // from silently clobbering each other, and requires the caller to at
    // least hold the current key metadata. Note the server cannot
    // cryptographically prove DEK possession (it never sees keys); the
    // restriction above is what keeps an arbitrary editor from locking the
    // section, since possession itself cannot be checked here.
    const result = await this.db
      .updateTable('pages')
      .set({
        encryptionMeta: { ...dto.encryptionMeta },
        updatedAt: new Date(),
      })
      .where('id', '=', page.id)
      .where('isEncrypted', '=', true)
      .where(sql`encryption_meta->>'wrappedDek'`, '=', dto.currentWrappedDek)
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) === 0) {
      throw new ConflictException(
        'The encryption key was changed by someone else. Reload and try again.',
      );
    }
  }

  /**
   * Every page keyed to this encryption root, the root itself included.
   *
   * Note this is the *pointer* view of a section, while encryption uses the
   * *tree* view (getPageAndDescendants). The two agree only because the move
   * rules forbid a keyed page from leaving its subtree — see
   * assertEncryptionMoveAllowed. Decryption deliberately uses the pointer
   * view: it must reach every page depending on this key, even one that
   * somehow escaped the subtree.
   */
  async getKeyedPageIds(rootPageId: string): Promise<string[]> {
    // deliberately includes soft-deleted pages: their ciphertext would be
    // unreadable forever if the root were decrypted without them
    const keyed = await this.db
      .selectFrom('pages')
      .select('id')
      .where('encryptionRootId', '=', rootPageId)
      .execute();

    return [rootPageId, ...keyed.map((p) => p.id)];
  }

  /**
   * Convert an encrypted page — and every page keyed to it — back to normal
   * pages. The client decrypts and sends the plaintext prosemirror JSON for
   * each. Decrypting a root necessarily decrypts everything it keys: leaving
   * a descendant behind would strand it with no reachable wrapped DEK.
   */
  async convertToDecrypted(
    page: Page,
    dto: ConvertToDecryptedDto,
    user: User,
  ): Promise<void> {
    if (!page.isEncrypted) {
      throw new BadRequestException('Page is not encrypted');
    }

    if (page.encryptionRootId) {
      throw new BadRequestException(
        'Decrypt the encrypted section this page belongs to instead',
      );
    }

    // Same bar as changing the password, for the same reason. The server cannot
    // prove the caller holds the DEK, and this request replaces the section's
    // ciphertext with whatever plaintext it carries and drops the encrypted
    // history — so an editor who never knew the password could otherwise
    // overwrite the whole section with content of their own, unrecoverably.
    await this.assertCanManageSectionKey(page, user);

    const contents = new Map<string, any>([[page.id, dto.content]]);
    // manifest encryptedVersion per page, checked under lock: the plaintext
    // was decrypted from that version's blob, so a newer encrypted save must
    // refuse the conversion rather than be silently overwritten
    const baseVersions = new Map<string, number>([
      [page.id, dto.baseVersion],
    ]);
    for (const descendant of dto.descendants ?? []) {
      contents.set(descendant.pageId, descendant.content);
      baseVersions.set(descendant.pageId, descendant.baseVersion);
    }

    const pageIds = await this.getKeyedPageIds(page.id);
    if (
      contents.size !== pageIds.length ||
      pageIds.some((id) => !contents.has(id))
    ) {
      throw new ConflictException(
        'This section changed while it was being decrypted. Reload and try again.',
      );
    }

    await this.assertCanEditWholeSection(pageIds, user, page.spaceId);

    // Building the text and ydoc forms costs a full prosemirror schema build
    // and parse per page. Doing that here rather than inside the transaction
    // keeps the row locks short, and rejects invalid content before any write.
    const plaintext = new Map<
      string,
      { content: any; textContent: string; ydoc: Buffer }
    >();
    for (const pageId of pageIds) {
      const content = contents.get(pageId);
      try {
        jsonToNode(content);
      } catch (err) {
        throw new BadRequestException('Invalid content format');
      }
      plaintext.set(pageId, {
        content,
        textContent: jsonToText(content),
        ydoc: createYdocFromJson(content),
      });
    }

    await executeTx(this.db, async (trx) => {
      const lockedRows = await this.lockAndVerifySection(
        trx,
        pageIds,
        page.spaceId,
        (tx) => this.keyedPageIdsInTx(tx, page.id),
        'This section changed while it was being decrypted. Reload and try again.',
      );

      // Same freshness rule as the encrypt direction, keyed on the encrypted
      // save counter instead of updatedAt: a save that landed after the
      // manifest bumped encryptedVersion, and this write would replace that
      // ciphertext with plaintext decrypted from the older blob.
      if (staleVersionPageId(lockedRows, baseVersions)) {
        throw new ConflictException(
          'This section changed while it was being decrypted. Reload and try again.',
        );
      }

      // one statement for the whole section, as in convertToEncrypted
      const rows = pageIds.map((pageId) => {
        const { content, textContent, ydoc } = plaintext.get(pageId);
        return sql`(
          ${pageId}::uuid,
          ${JSON.stringify(content)}::text::jsonb,
          ${textContent}::text,
          ${ydoc}::bytea
        )`;
      });

      const updated = await sql<{ id: string }>`
        UPDATE pages SET
          is_encrypted = false,
          encryption_meta = NULL,
          encrypted_by_id = NULL,
          encryption_root_id = NULL,
          encrypted_blob = NULL,
          encrypted_version = 0,
          content = v.content,
          text_content = v.text_content,
          ydoc = v.ydoc,
          last_updated_by_id = ${user.id}::uuid,
          updated_at = NOW()
        FROM (VALUES ${sql.join(rows)}) AS v(id, content, text_content, ydoc)
        WHERE pages.id = v.id AND pages.is_encrypted = true
        RETURNING pages.id
      `.execute(trx);

      if (updated.rows.length !== pageIds.length) {
        throw new ConflictException(
          'This section changed while it was being decrypted. Reload and try again.',
        );
      }

      // encrypted history snapshots are useless without the old key wrapper
      await trx
        .deleteFrom('pageHistory')
        .where('pageId', 'in', pageIds)
        .where('isEncrypted', '=', true)
        .execute();
    });

    // the pages are plaintext now: no encrypted relay session may linger
    await Promise.all(
      pageIds.map((pageId) =>
        Promise.resolve(this.e2eeRelayService.closeRoom(pageId)).catch((err) =>
          this.logger.warn(
            `Failed to close e2ee relay room for decrypted page ${pageId}`,
            err,
          ),
        ),
      ),
    );

    this.eventEmitter.emit(EventName.PAGE_UPDATED, {
      pageIds,
      workspaceId: page.workspaceId,
    });
  }
}
