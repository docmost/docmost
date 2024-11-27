import { Injectable, Logger } from '@nestjs/common';
import { jsonToHtml } from '../../collaboration/collaboration.util';
import { turndown } from './turndown-utils';
import { ExportFormat } from './dto/export-dto';
import { Page } from '@docmost/db/types/entity.types';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import * as JSZip from 'jszip';
import { StorageService } from '../storage/storage.service';
import {
  buildTree,
  computeLocalPath,
  getAttachmentIds,
  getExportExtension,
  getPageTitle,
  getProsemirrorContent,
  PageExportTree,
  replaceInternalLinks,
  updateAttachmentUrls,
} from './utils';
import { PageRepo } from '@docmost/db/repos/page/page.repo';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly spaceRepo: SpaceRepo,
    private readonly pageRepo: PageRepo,
    @InjectKysely() private readonly db: KyselyDB,
    private readonly storageService: StorageService,
  ) {}

  async exportPage(format: string, page: Page) {
    const titleNode = {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: getPageTitle(page.title) }],
    };

    let prosemirrorJson: any = getProsemirrorContent(page.content);

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
      return turndown(pageHtml);
    }

    return;
  }

  async exportPageWithChildren(pageId: string, format: string) {
    const pages = await this.pageRepo.getPageAndDescendants(pageId);

    // throw if no data
    if (!pages || pages.length === 0) {
      // throw
    }

    // is page a child of another page?
    // if yes then the parentPageId has a value, the code does not work in such cases
    // we should figure out a way to deal with it
    const parentPageIndex = pages.findIndex((obj) => obj.id === pageId);
    pages[parentPageIndex].parentPageId = null;

    const tree = buildTree(pages as Page[]);

    const zip = new JSZip();
    await this.zipPages(tree, format, zip);

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
      // throw
    }

    const pages = await this.db
      .selectFrom('pages')
      .select([
        'pages.id',
        'pages.slugId',
        'pages.title',
        'pages.content',
        'pages.parentPageId',
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

    const fileName = `${space.name}-export.zip`;
    return {
      fileBuffer: zipFile,
      fileName,
    };
  }

  async zipPages(
    tree: PageExportTree,
    format: string,
    zip: JSZip,
    includeAttachments = true,
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

        const prosemirrorJson = getProsemirrorContent(page.content);

        const currentPagePath = slugIdToPath[page.slugId];

        let updatedJsonContent = replaceInternalLinks(
          prosemirrorJson,
          slugIdToPath,
          currentPagePath,
        );

        if (includeAttachments) {
          await this.zipAttachments(updatedJsonContent, folder);
          updatedJsonContent = updateAttachmentUrls(updatedJsonContent);
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

  async zipAttachments(prosemirrorJson: any, zip: JSZip) {
    const attachmentIds = getAttachmentIds(prosemirrorJson);

    if (attachmentIds.length > 0) {
      const attachments = await this.db
        .selectFrom('attachments')
        .selectAll()
        .where('id', 'in', attachmentIds)
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
}

/*
[backend] tree {
[backend]   'a8d36c4a-9984-441f-91f7-b13e28f54b36': [
[backend]     {
[backend]       id: '774d2b29-5bf1-403f-8335-528347c49ca0',
[backend]       slugId: 'MJjN28GBGJh8',
[backend]       title: 'Sales Team',
[backend]       icon: '👥',
[backend]       content: [Object],
[backend]       parentPageId: 'a8d36c4a-9984-441f-91f7-b13e28f54b36'
[backend]     }
[backend]   ],
[backend]   '774d2b29-5bf1-403f-8335-528347c49ca0': [
[backend]     {
[backend]       id: 'c2b5e7eb-729a-4051-924d-6429bb1ff570',
[backend]       slugId: 'On2Q0G9SDmcl',
[backend]       title: 'Staff',
[backend]       icon: '👩‍💻',
[backend]       content: [Object],
[backend]       parentPageId: '774d2b29-5bf1-403f-8335-528347c49ca0'
[backend]     },
[backend]     {
[backend]       id: '7b1a5781-cffe-431c-91f2-11b6e29caa6c',
[backend]       slugId: 'UBFEEuTjQBav',
[backend]       title: 'Execs',
[backend]       icon: '💵',
[backend]       content: [Object],
[backend]       parentPageId: '774d2b29-5bf1-403f-8335-528347c49ca0'
[backend]     }
[backend]   ],
[backend]   '7b1a5781-cffe-431c-91f2-11b6e29caa6c': [
[backend]     {
[backend]       id: 'fbc22f11-6f0a-4efa-9e2e-8e1ce794b47f',
[backend]       slugId: 'FKVKBVOrqe',
[backend]       title: 'Math Zecs',
[backend]       icon: null,
[backend]       content: [Object],
[backend]       parentPageId: '7b1a5781-cffe-431c-91f2-11b6e29caa6c'
[backend]     }
[backend]   ],
[backend]   'fbc22f11-6f0a-4efa-9e2e-8e1ce794b47f': [
[backend]     {
[backend]       id: '31a8fd70-9b40-4e1c-ac05-9e7ead957dd3',
[backend]       slugId: '1STtdJ8scY',
[backend]       title: 'EWU SCHL',
[backend]       icon: null,
[backend]       content: [Object],
[backend]       parentPageId: 'fbc22f11-6f0a-4efa-9e2e-8e1ce794b47f'
[backend]     }
[backend]   ]
[backend] }


*/
