import { Injectable } from '@nestjs/common';
import { jsonToHtml } from '../../collaboration/collaboration.util';
import { turndown } from './turndown-utils';
import { ExportFormat } from './dto/export-dto';
import { Page } from '@docmost/db/types/entity.types';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import * as JSZip from 'jszip';

@Injectable()
export class ExportService {
  constructor(
    private readonly spaceRepo: SpaceRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async exportPage(format: string, page: Page) {
    const titleNode = {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: page.title }],
    };

    let prosemirrorJson: any = page.content || { type: 'doc', content: [] };

    if (page.title) {
      prosemirrorJson.content.unshift(titleNode);
    }

    const pageHtml = jsonToHtml(prosemirrorJson);

    if (format === ExportFormat.HTML) {
      return `<!DOCTYPE html><html><head><title>${page.title}</title></head><body>${pageHtml}</body></html>`;
    }

    if (format === ExportFormat.Markdown) {
      return turndown(pageHtml);
    }

    return;
  }

  async exportSpace(spaceId: string, format: string) {
    // select all pages in the space? that the user has access to? or only allow admins to do this?
    // we could allow ordinary users to only export pages and their sub children

    // TODO - MVP
    // select all pages in space
    // format them as tree
    // convert them to the export format
    // zip them

    // TODO - work
    // select all pages where spaceId = id.
    // now, we need to create a tree with the pages by their parent associations
    // should that be done on the db side or code side?
    // I think code side is the best way to go about it

    // we are to create a tree
    // loop through the resulting array, traverse by parent id and create a tree

    // get the space data.
    // make sure user has permission to space
    // create a folder with the space name as the folder title
    // insert the files into the folder
    const space = await this.db
      .selectFrom('spaces')
      .selectAll()
      .where('id', '=', spaceId)
      .executeTakeFirst();

    const pages = await this.db
      .selectFrom('pages')
      .select([
        'pages.id',
        'pages.title',
        'pages.content',
        'pages.parentPageId',
      ])
      .where('spaceId', '=', spaceId)
      .execute();

    const tree = this.buildTree(pages as Page[]);

    const zip = new JSZip();

    await this.exportTree(tree, format, zip);

    const zipFile = zip.generateNodeStream({
      type: 'nodebuffer',
      streamFiles: true,
      compression: 'DEFLATE',
    });

    // todo:
    // account for pages in same directory with the same name
    // account for attached files and images with their links
    // fix internal page links
    /*
    for (const page of pages) {
      // first, add root pages to the export root
      if (page.parentPageId === null) {
        const pageContent = await this.exportPage(format, page as Page);
        zip.file(`${page.title || 'untitled'}.${format}`, pageContent);

        // to make this recursive, we have to create a reusable function
        await this.archiveChildPages(
          page as Page,
          pages as Page[],
          format,
          zip,
        );
      }
    }

    const zipFile = await zip.generateNodeStream({
      type: 'nodebuffer',
      streamFiles: true,
      compression: 'DEFLATE',
    });
*/
    const fileName = `${space.name}-export.zip`;
    //console.log(zipFile);

    return {
      fileBuffer: zipFile,
      fileName,
    };
  }

  async archiveChildPages(
    parentPage: Page,
    pages: Page[],
    format: string,
    parentFolder: JSZip,
  ) {
    for (const childPage of pages) {
      if (childPage.parentPageId === parentPage.id) {
        const pageContent = await this.exportPage(format, childPage as Page);

        const childFolder = parentFolder
          .folder(parentPage.title || 'untitled')
          .file(childPage.title + '.html', pageContent);

        // get folder path
        await this.archiveChildPages(
          childPage as Page,
          pages as Page[],
          format,
          childFolder,
        );
      }
    }
  }

  buildTree(pages: Page[]) {
    const tree: Record<string, Page[]> = {};

    for (const page of pages) {
      const parentPageId = page.parentPageId;
      if (!tree[parentPageId]) {
        tree[parentPageId] = [];
      }
      tree[parentPageId].push(page);
    }
    return tree;
  }

  async exportTree(tree: Record<string, Page[]>, format: string, zip: JSZip) {
    const stack: { folder: JSZip; parentPageId: string }[] = [
      { folder: zip, parentPageId: null },
    ];

    while (stack.length > 0) {
      const { folder, parentPageId } = stack.pop();
      const children = tree[parentPageId] || [];

      for (const page of children) {
        const childPages = tree[page.id] || [];

        const pageTitle = page.title ? page.title : 'untitled';
        const pageContent = this.exportPage(format, page);

        folder.file(`${pageTitle}.${format}`, pageContent);

        if (childPages.length > 0) {
          const pageFolder = folder.folder(pageTitle);
          stack.push({ folder: pageFolder, parentPageId: page.id });
        }
      }
    }
  }

}

// we have got the pages and the pages have got children
// what do we do
// we have to create root pages first without parents
// then we create new directories with the names of root pages and then add their childrent to it recursivelu

// Attachments
// we should traverse all attachments by spaceId and linked to pages
//

// we should check each page for attachments and fetch all the attachment ids
// we should store the attachments relative to the pages directory
// we should rewrite the attachments to point locally to the pages
// we should think ahead of the import back to docmost

// WE COULD WORK OUT INTERNAL LINKS BY KEEPING TRACK OF THE PAGE ID AND IT'S USAGE ACROSS
// WE THEN PROCESS THE PROSEMIRROR STATE AND REPLACE THE INTERNAL LINK STRUCTURE WITH BUILT PATHS

// WE COULD STORE ALL THE ATTACHMENTS IN THE ROOT DIR /FILES FOLDER, MAINTAINING THEIR IDS
// THEN WE INTERNALLY LINK THEM OR JUST LEAVE THE DEFAULT /FILES/UUID/STR.JPG
// WHICH TO WORK ON FIRST

// FILES
// WE GET THE FILES IN THE PROSEMIRROR JSON OF ALL PAGES OR BY SPACE ID?
// files are broad though. we have to do same for attachments, images, videos, excalidraw and drawio.
