import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
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
import {
  createYdocFromJson,
} from '../../../common/helpers/prosemirror/utils';
import { jsonToNode, jsonToText } from 'src/collaboration/collaboration.util';
import { CollaborationGateway } from '../../../collaboration/collaboration.gateway';
import { sql } from 'kysely';

@Injectable()
export class PageEncryptionService {
  private readonly logger = new Logger(PageEncryptionService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pageRepo: PageRepo,
    private eventEmitter: EventEmitter2,
    private readonly collaborationGateway: CollaborationGateway,
  ) {}

  async getEncryptedBlob(page: Page) {
    if (!page.isEncrypted) {
      throw new BadRequestException('Page is not encrypted');
    }

    const withBlob = await this.pageRepo.findById(page.id, {
      includeEncryptedBlob: true,
    });

    return {
      pageId: page.id,
      encryptionMeta: withBlob.encryptionMeta,
      encryptedBlob: withBlob.encryptedBlob
        ? Buffer.from(withBlob.encryptedBlob).toString('base64')
        : null,
      version: Number(withBlob.encryptedVersion),
    };
  }

  /**
   * Turn a plaintext page into an E2E-encrypted one. The client sends the
   * already-encrypted document blob and key metadata; every plaintext trace
   * (content, text_content, ydoc, history, backlinks, transclusions) is
   * removed in the same transaction.
   */
  async convertToEncrypted(
    page: Page,
    dto: ConvertToEncryptedDto,
    user: User,
  ): Promise<void> {
    if (page.isEncrypted) {
      throw new BadRequestException('Page is already encrypted');
    }

    await executeTx(this.db, async (trx) => {
      const result = await trx
        .updateTable('pages')
        .set({
          isEncrypted: true,
          encryptionMeta: { ...dto.encryptionMeta },
          encryptedBlob: Buffer.from(dto.encryptedBlob, 'base64'),
          encryptedVersion: '1',
          content: null,
          textContent: null,
          ydoc: null,
          lastUpdatedById: user.id,
          updatedAt: new Date(),
        })
        .where('id', '=', page.id)
        .where('isEncrypted', '=', false)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        // someone converted (or deleted) the page concurrently — abort so the
        // side-effect deletes below never run against the wrong state
        throw new ConflictException('Page was already encrypted');
      }

      // plaintext snapshots must not survive the conversion
      await trx
        .deleteFrom('pageHistory')
        .where('pageId', '=', page.id)
        .execute();

      // link/transclusion data is derived from plaintext content
      await trx
        .deleteFrom('backlinks')
        .where('sourcePageId', '=', page.id)
        .execute();
      await trx
        .deleteFrom('pageTransclusions')
        .where('pageId', '=', page.id)
        .execute();

      // an encrypted page cannot be publicly shared
      await trx.deleteFrom('shares').where('pageId', '=', page.id).execute();

      // comments may quote page content; they must not survive either
      await trx.deleteFrom('comments').where('pageId', '=', page.id).execute();
    });

    // kick every live collaboration session off the now-encrypted document
    // so no plaintext ydoc lingers in collab server memory
    try {
      await this.collaborationGateway.closeDocumentConnections(
        `page.${page.id}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to close collab connections for encrypted page ${page.id}`,
        err,
      );
    }

    this.eventEmitter.emit(EventName.PAGE_UPDATED, {
      pageIds: [page.id],
      workspaceId: page.workspaceId,
    });
  }

  /**
   * Save a new ciphertext for an encrypted page with optimistic locking:
   * the write only succeeds if the client's baseVersion matches the stored
   * version, otherwise another client saved first and we return 409.
   */
  async updateEncrypted(
    page: Page,
    dto: UpdateEncryptedPageDto,
    user: User,
  ): Promise<{ version: number }> {
    if (!page.isEncrypted) {
      throw new BadRequestException('Page is not encrypted');
    }

    const contributors = new Set<string>(page.contributorIds);
    contributors.add(user.id);

    const newVersion = dto.baseVersion + 1;

    const result = await this.db
      .updateTable('pages')
      .set({
        encryptedBlob: Buffer.from(dto.encryptedBlob, 'base64'),
        encryptedVersion: String(newVersion),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        lastUpdatedById: user.id,
        contributorIds: Array.from(contributors),
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

    if (dto.saveHistory) {
      try {
        await this.db
          .insertInto('pageHistory')
          .values({
            pageId: page.id,
            slugId: page.slugId,
            title: dto.title ?? page.title,
            icon: page.icon,
            coverPhoto: page.coverPhoto,
            isEncrypted: true,
            encryptedBlob: Buffer.from(dto.encryptedBlob, 'base64'),
            encryptionMeta: page.encryptionMeta,
            version: newVersion,
            lastUpdatedById: user.id,
            spaceId: page.spaceId,
            workspaceId: page.workspaceId,
          })
          .execute();
      } catch (err) {
        this.logger.error('Failed to save encrypted page history', err);
      }
    }

    this.eventEmitter.emit(EventName.PAGE_UPDATED, {
      pageIds: [page.id],
      workspaceId: page.workspaceId,
    });

    return { version: newVersion };
  }

  /**
   * Password change: replace the key metadata (re-wrapped DEK). The
   * ciphertext itself is unchanged.
   */
  async rewrapKey(page: Page, dto: RewrapEncryptionKeyDto): Promise<void> {
    if (!page.isEncrypted) {
      throw new BadRequestException('Page is not encrypted');
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
      .where(
        sql`encryption_meta->>'wrappedDek'`,
        '=',
        dto.currentWrappedDek,
      )
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) === 0) {
      throw new ConflictException(
        'The encryption key was changed by someone else. Reload and try again.',
      );
    }
  }

  /**
   * Convert an encrypted page back to a normal one. The client decrypts and
   * sends the plaintext prosemirror JSON.
   */
  async convertToDecrypted(
    page: Page,
    dto: ConvertToDecryptedDto,
    user: User,
  ): Promise<void> {
    if (!page.isEncrypted) {
      throw new BadRequestException('Page is not encrypted');
    }

    let prosemirrorJson: any = dto.content;
    try {
      jsonToNode(prosemirrorJson);
    } catch (err) {
      throw new BadRequestException('Invalid content format');
    }

    await executeTx(this.db, async (trx) => {
      const result = await trx
        .updateTable('pages')
        .set({
          isEncrypted: false,
          encryptionMeta: null,
          encryptedBlob: null,
          encryptedVersion: '0',
          content: prosemirrorJson,
          textContent: jsonToText(prosemirrorJson),
          ydoc: createYdocFromJson(prosemirrorJson),
          lastUpdatedById: user.id,
          updatedAt: new Date(),
        })
        .where('id', '=', page.id)
        .where('isEncrypted', '=', true)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new ConflictException('Page is no longer encrypted');
      }

      // encrypted history snapshots are useless without the old key wrapper
      await trx
        .deleteFrom('pageHistory')
        .where('pageId', '=', page.id)
        .where('isEncrypted', '=', true)
        .execute();
    });

    this.eventEmitter.emit(EventName.PAGE_UPDATED, {
      pageIds: [page.id],
      workspaceId: page.workspaceId,
    });
  }
}
