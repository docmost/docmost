import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
import { StorageService } from '../../integrations/storage/storage.service';
// Use legacy build for Node.js environment
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as mammoth from 'mammoth';

@Injectable()
export class AttachmentEeService {
  private readonly logger = new Logger(AttachmentEeService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly storageService: StorageService,
  ) {}

  async indexAttachment(attachmentId: string): Promise<void> {
    try {
      const attachment = await this.db
        .selectFrom('attachments')
        .select(['id', 'filePath', 'fileExt', 'fileName'])
        .where('id', '=', attachmentId)
        .executeTakeFirst();

      if (!attachment) {
        this.logger.warn(`Attachment ${attachmentId} not found`);
        return;
      }

      const fileExt = attachment.fileExt.toLowerCase();
      let textContent = '';

      if (fileExt === '.pdf') {
        textContent = await this.extractPdfText(attachment.filePath);
      } else if (fileExt === '.docx') {
        textContent = await this.extractDocxText(attachment.filePath);
      } else {
        this.logger.debug(`Unsupported file extension: ${fileExt}`);
        return;
      }

      if (textContent && textContent.trim().length > 0) {
        await this.updateAttachmentTextContent(attachmentId, textContent);
        this.logger.debug(`Indexed attachment ${attachmentId}: ${textContent.length} characters`);
      }
    } catch (err) {
      this.logger.error(`Error indexing attachment ${attachmentId}:`, err);
      throw err;
    }
  }

  async indexAttachments(workspaceId: string): Promise<void> {
    try {
      const attachments = await this.db
        .selectFrom('attachments')
        .select(['id'])
        .where('workspaceId', '=', workspaceId)
        .where('textContent', 'is', null)
        .where((eb) =>
          eb.or([
            eb('fileExt', '=', '.pdf'),
            eb('fileExt', '=', '.PDF'),
            eb('fileExt', '=', '.docx'),
            eb('fileExt', '=', '.DOCX'),
          ]),
        )
        .execute();

      this.logger.log(`Indexing ${attachments.length} attachments for workspace ${workspaceId}`);

      for (const attachment of attachments) {
        try {
          await this.indexAttachment(attachment.id);
        } catch (err) {
          this.logger.error(`Failed to index attachment ${attachment.id}:`, err);
        }
      }
    } catch (err) {
      this.logger.error(`Error bulk indexing attachments:`, err);
      throw err;
    }
  }

  async reindexAllAttachments(workspaceId: string): Promise<{ total: number; success: number; failed: number }> {
    try {
      // Reset all text_content to force re-indexing
      await sql`
        UPDATE attachments
        SET text_content = NULL, tsv = NULL
        WHERE workspace_id = ${workspaceId}
          AND LOWER(file_ext) IN ('.pdf', '.docx')
      `.execute(this.db);

      // Get all PDF/DOCX attachments
      const attachments = await this.db
        .selectFrom('attachments')
        .select(['id', 'fileName'])
        .where('workspaceId', '=', workspaceId)
        .where((eb) =>
          eb.or([
            eb('fileExt', '=', '.pdf'),
            eb('fileExt', '=', '.PDF'),
            eb('fileExt', '=', '.docx'),
            eb('fileExt', '=', '.DOCX'),
          ]),
        )
        .execute();

      this.logger.log(`Re-indexing ALL ${attachments.length} PDF/DOCX attachments for workspace ${workspaceId}`);

      let success = 0;
      let failed = 0;

      for (const attachment of attachments) {
        try {
          await this.indexAttachment(attachment.id);
          success++;
          this.logger.log(`Re-indexed: ${attachment.fileName}`);
        } catch (err) {
          failed++;
          this.logger.error(`Failed to re-index attachment ${attachment.id} (${attachment.fileName}):`, err);
        }
      }

      this.logger.log(`Re-indexing completed: ${success} success, ${failed} failed out of ${attachments.length} total`);

      return { total: attachments.length, success, failed };
    } catch (err) {
      this.logger.error(`Error re-indexing all attachments:`, err);
      throw err;
    }
  }

  private async extractPdfText(filePath: string): Promise<string> {
    try {
      const fileBuffer = await this.storageService.read(filePath);
      const data = new Uint8Array(fileBuffer);

      const loadingTask = pdfjs.getDocument({ data });
      const pdfDocument = await loadingTask.promise;

      const textParts: string[] = [];

      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        textParts.push(pageText);
      }

      return textParts.join('\n\n');
    } catch (err) {
      this.logger.error(`Error extracting PDF text from ${filePath}:`, err);
      throw err;
    }
  }

  private async extractDocxText(filePath: string): Promise<string> {
    try {
      const fileBuffer = await this.storageService.read(filePath);
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    } catch (err) {
      this.logger.error(`Error extracting DOCX text from ${filePath}:`, err);
      throw err;
    }
  }

  private async updateAttachmentTextContent(
    attachmentId: string,
    textContent: string,
  ): Promise<void> {
    // Truncate text content if too long (PostgreSQL text field can handle large content but we limit for performance)
    const maxLength = 1000000; // 1MB of text
    const truncatedContent =
      textContent.length > maxLength
        ? textContent.substring(0, maxLength)
        : textContent;

    // Update text_content and generate tsv for full-text search
    await sql`
      UPDATE attachments
      SET text_content = ${truncatedContent},
          tsv = to_tsvector('english', f_unaccent(${truncatedContent}))
      WHERE id = ${attachmentId}
    `.execute(this.db);
  }
}
