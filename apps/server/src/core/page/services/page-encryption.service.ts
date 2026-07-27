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
import { encryptionRootIdOf } from '../page-encryption.util';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';

/**
 * Upper bound on a single subtree conversion. The whole tree is converted in
 * one transaction, so this caps both the request size and how long the write
 * lock is held. Larger trees are rejected rather than partially converted.
 */
export const MAX_ENCRYPTED_TREE_PAGES = 200;

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

    const subtree = await this.loadConvertibleSubtree(page.id, {
      includeContent: true,
    });

    await this.assertCanEditWholeSection(
      subtree.map((p) => p.id),
      user,
      page.spaceId,
    );

    return {
      kind: 'plaintext' as const,
      pages: subtree.map((p) => ({
        pageId: p.id,
        title: p.title,
        content: p.content,
      })),
    };
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
    rederive: (trx: KyselyTransaction) => Promise<string[]>,
    conflictMessage: string,
  ): Promise<void> {
    await trx
      .selectFrom('pages')
      .select('id')
      .where('id', 'in', expectedPageIds)
      .forUpdate()
      .execute();

    const actual = await rederive(trx);
    const expected = new Set(expectedPageIds);

    if (
      actual.length !== expectedPageIds.length ||
      actual.some((id) => !expected.has(id))
    ) {
      throw new ConflictException(conflictMessage);
    }
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
  ): Promise<void> {
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
    for (const descendant of dto.descendants ?? []) {
      blobs.set(descendant.pageId, descendant.encryptedBlob);
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
    if (dto.move && pageIds.includes(dto.move.parentPageId)) {
      throw new BadRequestException(
        'Cannot move a page inside one of its own sub-pages',
      );
    }

    // the pages being converted, plus — when joining — the section being
    // written into: edit rights on the dragged page alone must not be enough
    // to push pages into a section the user may only read
    await this.assertCanEditWholeSection(
      joinRoot ? [...pageIds, joinRoot.id, dto.move.parentPageId] : pageIds,
      user,
      page.spaceId,
    );

    await executeTx(this.db, async (trx) => {
      await this.lockAndVerifySection(
        trx,
        pageIds,
        (tx) => this.descendantIdsInTx(tx, page.id),
        'This section changed while it was being encrypted. Reload and try again.',
      );

      if (joinRoot) {
        // Re-check under row locks: between the validation above and this
        // write the section could have been decrypted, or the destination
        // could have been moved or deleted out of it — either would key these
        // pages to a root their new location cannot reach.
        const locked = await trx
          .selectFrom('pages')
          .select([
            'id',
            'isEncrypted',
            'encryptionRootId',
            'encryptionMeta',
            'deletedAt',
          ])
          .where('id', 'in', [joinRoot.id, dto.move.parentPageId])
          .forUpdate()
          .execute();

        const root = locked.find((p) => p.id === joinRoot.id);
        const destination = locked.find(
          (p) => p.id === dto.move.parentPageId,
        );

        if (
          !root?.isEncrypted ||
          root.encryptionRootId ||
          !root.encryptionMeta ||
          root.deletedAt ||
          !destination ||
          destination.deletedAt ||
          encryptionRootIdOf(destination as any) !== joinRoot.id
        ) {
          throw new ConflictException(
            'That encrypted section changed while these pages were being encrypted. Reload and try again.',
          );
        }
      }

      for (const pageId of pageIds) {
        // when joining a section every page is keyed to it, the dragged page
        // included; when starting one the dragged page becomes the key holder
        const isNewRoot = !joinRoot && pageId === page.id;
        const isMovedPage = pageId === page.id;

        const result = await trx
          .updateTable('pages')
          .set({
            isEncrypted: true,
            encryptionMeta: isNewRoot ? { ...dto.encryptionMeta } : null,
            encryptionRootId: isNewRoot ? null : (joinRoot?.id ?? page.id),
            encryptedBlob: Buffer.from(blobs.get(pageId), 'base64'),
            encryptedVersion: '1',
            content: null,
            textContent: null,
            ydoc: null,
            lastUpdatedById: user.id,
            updatedAt: new Date(),
            // a drag into a section converts and relocates in one write
            ...(dto.move && isMovedPage
              ? {
                  parentPageId: dto.move.parentPageId,
                  position: dto.move.position,
                }
              : {}),
          })
          .where('id', '=', pageId)
          .where('isEncrypted', '=', false)
          .executeTakeFirst();

        if (Number(result.numUpdatedRows) === 0) {
          // someone converted (or deleted) a page concurrently — abort so the
          // side-effect deletes below never run against the wrong state
          throw new ConflictException(
            'This section changed while it was being encrypted. Reload and try again.',
          );
        }
      }

      // plaintext snapshots must not survive the conversion
      await trx.deleteFrom('pageHistory').where('pageId', 'in', pageIds).execute();

      // link/transclusion data is derived from plaintext content
      await trx
        .deleteFrom('backlinks')
        .where('sourcePageId', 'in', pageIds)
        .execute();
      await trx
        .deleteFrom('pageTransclusions')
        .where('pageId', 'in', pageIds)
        .execute();

      // an encrypted page cannot be publicly shared
      await trx.deleteFrom('shares').where('pageId', 'in', pageIds).execute();

      // comments may quote page content; they must not survive either
      await trx.deleteFrom('comments').where('pageId', 'in', pageIds).execute();
    });

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

    this.eventEmitter.emit(EventName.PAGE_UPDATED, {
      pageIds,
      workspaceId: page.workspaceId,
    });
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
   * Password change: replace the key metadata (re-wrapped DEK). The
   * ciphertext itself is unchanged.
   */
  async rewrapKey(page: Page, dto: RewrapEncryptionKeyDto): Promise<void> {
    if (!page.isEncrypted) {
      throw new BadRequestException('Page is not encrypted');
    }

    if (page.encryptionRootId) {
      throw new BadRequestException(
        'The password is managed by the encrypted section this page belongs to',
      );
    }

    // Compare-and-swap on the current wrappedDek: prevents concurrent rewraps
    // from silently clobbering each other, and requires the caller to at
    // least hold the current key metadata. Note the server cannot
    // cryptographically prove DEK possession (it never sees keys); a
    // malicious editor could still replace the meta, but that is a lockout
    // (DoS) equivalent to deleting the page — not a confidentiality issue.
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

    const contents = new Map<string, any>([[page.id, dto.content]]);
    for (const descendant of dto.descendants ?? []) {
      contents.set(descendant.pageId, descendant.content);
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
      await this.lockAndVerifySection(
        trx,
        pageIds,
        (tx) => this.keyedPageIdsInTx(tx, page.id),
        'This section changed while it was being decrypted. Reload and try again.',
      );

      for (const pageId of pageIds) {
        const result = await trx
          .updateTable('pages')
          .set({
            isEncrypted: false,
            encryptionMeta: null,
            encryptionRootId: null,
            encryptedBlob: null,
            encryptedVersion: '0',
            ...plaintext.get(pageId),
            lastUpdatedById: user.id,
            updatedAt: new Date(),
          })
          .where('id', '=', pageId)
          .where('isEncrypted', '=', true)
          .executeTakeFirst();

        if (Number(result.numUpdatedRows) === 0) {
          throw new ConflictException(
            'This section changed while it was being decrypted. Reload and try again.',
          );
        }
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
