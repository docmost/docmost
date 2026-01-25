import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { jsonToHtml, jsonToNode } from '../../collaboration/collaboration.util';
import { ExportFormat } from './dto/export-dto';
import { Page } from '@docmost/db/types/entity.types';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import * as JSZip from 'jszip';
import { StorageService } from '../storage/storage.service';
import {
  buildTree,
  computeLocalPath,
  getExportExtension,
  getPageTitle,
  PageExportTree,
  replaceInternalLinks,
  updateAttachmentUrlsToLocalPaths,
} from './utils';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { Node } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import slugify = require('@sindresorhus/slugify');
import { EnvironmentService } from '../environment/environment.service';
import {
  getAttachmentIds,
  getProsemirrorContent,
} from '../../common/helpers/prosemirror/utils';
import { htmlToMarkdown } from '@docmost/editor-ext';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly pageRepo: PageRepo,
    @InjectKysely() private readonly db: KyselyDB,
    private readonly storageService: StorageService,
    private readonly environmentService: EnvironmentService,
  ) {}

  async exportPage(format: string, page: Page, singlePage?: boolean) {
    const titleNode = {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: getPageTitle(page.title) }],
    };

    let prosemirrorJson: any;

    if (singlePage) {
      prosemirrorJson = await this.turnPageMentionsToLinks(
        getProsemirrorContent(page.content),
        page.workspaceId,
      );
    } else {
      // mentions is already turned to links during the zip process
      prosemirrorJson = getProsemirrorContent(page.content);
    }

    if (page.title) {
      prosemirrorJson.content.unshift(titleNode);
    }

    const pageHtml = jsonToHtml(prosemirrorJson);

    if (format === ExportFormat.HTML) {
      return `<!DOCTYPE html>
      <html>
        <head>
         <title>${getPageTitle(page.title)}</title>
        </head>
        <body>${pageHtml}</body>
      </html>`;
    }

    if (format === ExportFormat.Markdown) {
      const newPageHtml = pageHtml.replace(
        /<colgroup[^>]*>[\s\S]*?<\/colgroup>/gim,
        '',
      );
      return htmlToMarkdown(newPageHtml);
    }

    return;
  }

  async exportPages(
    pageId: string,
    format: string,
    includeAttachments: boolean,
    includeChildren: boolean,
  ) {
    let pages: Page[];

    if (includeChildren) {
      //@ts-ignore
      pages = await this.pageRepo.getPageAndDescendants(pageId, {
        includeContent: true,
      });
    } else {
      // Only fetch the single page when includeChildren is false
      const page = await this.pageRepo.findById(pageId, {
        includeContent: true,
      });
      if (page){
        pages = [page];
      }
    }

    if (!pages || pages.length === 0) {
      throw new BadRequestException('No pages to export');
    }

    const parentPageIndex = pages.findIndex((obj) => obj.id === pageId);
    // set to null to make export of pages with parentId work
    pages[parentPageIndex].parentPageId = null;

    const tree = buildTree(pages as Page[]);

    const zip = new JSZip();
    await this.zipPages(tree, format, zip, includeAttachments);

    const zipFile = zip.generateNodeStream({
      type: 'nodebuffer',
      streamFiles: true,
      compression: 'DEFLATE',
    });

    return zipFile;
  }

  async exportSpace(
    spaceId: string,
    format: string,
    includeAttachments: boolean,
  ) {
    const space = await this.db
      .selectFrom('spaces')
      .selectAll()
      .where('id', '=', spaceId)
      .executeTakeFirst();

    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const pages = await this.db
      .selectFrom('pages')
      .select([
        'pages.id',
        'pages.slugId',
        'pages.title',
        'pages.content',
        'pages.parentPageId',
        'pages.spaceId',
        'pages.workspaceId',
      ])
      .where('spaceId', '=', spaceId)
      .execute();

    const tree = buildTree(pages as Page[]);

    const zip = new JSZip();

    await this.zipPages(tree, format, zip, includeAttachments);

    const zipFile = zip.generateNodeStream({
      type: 'nodebuffer',
      streamFiles: true,
      compression: 'DEFLATE',
    });

    const fileName = `${space.name}-space-export.zip`;
    return {
      fileStream: zipFile,
      fileName,
    };
  }

  async zipPages(
    tree: PageExportTree,
    format: string,
    zip: JSZip,
    includeAttachments: boolean,
  ): Promise<void> {
    const slugIdToPath: Record<string, string> = {};

    computeLocalPath(tree, format, null, '', slugIdToPath);

    const stack: { folder: JSZip; parentPageId: string }[] = [
      { folder: zip, parentPageId: null },
    ];

    while (stack.length > 0) {
      const { folder, parentPageId } = stack.pop();
      const children = tree[parentPageId] || [];

      for (const page of children) {
        const childPages = tree[page.id] || [];

        const prosemirrorJson = await this.turnPageMentionsToLinks(
          getProsemirrorContent(page.content),
          page.workspaceId,
        );

        const currentPagePath = slugIdToPath[page.slugId];

        let updatedJsonContent = replaceInternalLinks(
          prosemirrorJson,
          slugIdToPath,
          currentPagePath,
        );

        if (includeAttachments) {
          await this.zipAttachments(updatedJsonContent, page.spaceId, folder);
          updatedJsonContent =
            updateAttachmentUrlsToLocalPaths(updatedJsonContent);
        }

        const pageTitle = getPageTitle(page.title);
        const pageExportContent = await this.exportPage(format, {
          ...page,
          content: updatedJsonContent,
        });

        folder.file(
          `${pageTitle}${getExportExtension(format)}`,
          pageExportContent,
        );
        if (childPages.length > 0) {
          const pageFolder = folder.folder(pageTitle);
          stack.push({ folder: pageFolder, parentPageId: page.id });
        }
      }
    }
  }

  async zipAttachments(prosemirrorJson: any, spaceId: string, zip: JSZip) {
    const attachmentIds = getAttachmentIds(prosemirrorJson);

    if (attachmentIds.length > 0) {
      const attachments = await this.db
        .selectFrom('attachments')
        .selectAll()
        .where('id', 'in', attachmentIds)
        .where('spaceId', '=', spaceId)
        .execute();

      await Promise.all(
        attachments.map(async (attachment) => {
          try {
            const fileBuffer = await this.storageService.read(
              attachment.filePath,
            );
            const filePath = `/files/${attachment.id}/${attachment.fileName}`;
            zip.file(filePath, fileBuffer);
          } catch (err) {
            this.logger.debug(`Attachment export error ${attachment.id}`, err);
          }
        }),
      );
    }
  }

  async turnPageMentionsToLinks(prosemirrorJson: any, workspaceId: string) {
    const doc = jsonToNode(prosemirrorJson);

    const pageMentionIds = [];

    doc.descendants((node: Node) => {
      if (node.type.name === 'mention' && node.attrs.entityType === 'page') {
        if (node.attrs.entityId) {
          pageMentionIds.push(node.attrs.entityId);
        }
      }
    });

    if (pageMentionIds.length < 1) {
      return prosemirrorJson;
    }

    const pages = await this.db
      .selectFrom('pages')
      .select(['id', 'slugId', 'title', 'creatorId', 'spaceId', 'workspaceId'])
      .select((eb) => this.pageRepo.withSpace(eb))
      .where('id', 'in', pageMentionIds)
      .where('workspaceId', '=', workspaceId)
      .execute();

    const pageMap = new Map(pages.map((page) => [page.id, page]));

    let editorState = EditorState.create({
      doc: doc,
    });

    const transaction = editorState.tr;

    let offset = 0;

    /**
     * Helper function to replace a mention node with a link node.
     */
    const replaceMentionWithLink = (
      node: Node,
      pos: number,
      title: string,
      slugId: string,
      spaceSlug: string,
    ) => {
      const linkTitle = title || 'untitled';
      const truncatedTitle = linkTitle?.substring(0, 70);
      const pageSlug = `${slugify(truncatedTitle)}-${slugId}`;

      // Create the link URL
      const link = `${this.environmentService.getAppUrl()}/s/${spaceSlug}/p/${pageSlug}`;

      // Create a link mark and a text node with that mark
      const linkMark = editorState.schema.marks.link.create({ href: link });
      const linkTextNode = editorState.schema.text(linkTitle, [linkMark]);

      // Calculate positions (adjusted by the current offset)
      const from = pos + offset;
      const to = pos + offset + node.nodeSize;

      // Replace the node in the transaction and update the offset
      transaction.replaceWith(from, to, linkTextNode);
      offset += linkTextNode.nodeSize - node.nodeSize;
    };

    // find and convert page mentions to links
    editorState.doc.descendants((node: Node, pos: number) => {
      // Check if the node is a page mention
      if (node.type.name === 'mention' && node.attrs.entityType === 'page') {
        const { entityId: pageId, slugId, label } = node.attrs;
        const page = pageMap.get(pageId);

        if (page) {
          replaceMentionWithLink(
            node,
            pos,
            page.title,
            page.slugId,
            page.space.slug,
          );
        } else {
          // if page is not found, default to  the node label and slugId
          replaceMentionWithLink(node, pos, label, slugId, 'undefined');
        }
      }
    });

    if (transaction.docChanged) {
      editorState = editorState.apply(transaction);
    }

    const updatedDoc = editorState.doc;

    return updatedDoc.toJSON();
  }
}
