import { Injectable, Logger } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { MultipartFile } from '@fastify/multipart';
import { sanitize } from 'sanitize-filename-ts';
import * as path from 'path';
import { htmlToJson } from '../../collaboration/collaboration.util';
import { marked } from 'marked';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { generateSlugId } from '../../common/helpers';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { transformHTML } from './utils/html.utils';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly pageRepo: PageRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async importPage(
    filePromise: Promise<MultipartFile>,
    userId: string,
    spaceId: string,
    workspaceId: string,
  ): Promise<void> {
    const file = await filePromise;
    const buffer = await file.toBuffer();
    const sanitizedFilename = sanitize(file.filename);
    let fileName = sanitizedFilename.slice(0, 255);
    const fileExtension = path.extname(file.filename).toLowerCase();
    const fileMimeType = file.mimetype;

    const fileContent = buffer.toString();

    //TODO: get the page title
    // if the first node a h1 heading, use it as page title
    // else,  use the file name but without the file extension

    let prosemirrorJson = null;
    let createdPage = null;

    if (fileExtension.endsWith('.md') && fileMimeType === 'text/markdown') {
      fileName = fileName.split('.md')[0];
      prosemirrorJson = await this.processMarkdown(fileContent);
    }

    if (fileExtension.endsWith('.html') && fileMimeType === 'text/html') {
      fileName = fileName.split('.html')[0];
      prosemirrorJson = await this.processHTML(fileContent);
    }

    if (prosemirrorJson) {
      // Imported pages will go to the bottom of root node
      const lastPage = await this.db
        .selectFrom('pages')
        .select(['id', 'position'])
        .where('spaceId', '=', spaceId)
        .orderBy('position', 'desc')
        .limit(1)
        .where('parentPageId', 'is', null)
        .executeTakeFirst();

      let pagePosition: string;

      // if no existing page, make this the first
      if (lastPage) {
        pagePosition = generateJitteredKeyBetween(lastPage.position, null);
      } else {
        pagePosition = generateJitteredKeyBetween(null, null);
      }

      try {
        createdPage = await this.pageRepo.insertPage({
          slugId: generateSlugId(),
          title: fileName,
          content: prosemirrorJson,
          position: pagePosition,
          spaceId: spaceId,
          creatorId: userId,
          workspaceId: workspaceId,
          lastUpdatedById: userId,
        });
      } catch (err) {
        // use logger
        this.logger.error('failed to create imported page', err);
      }
    }

    return createdPage;
  }

  async processMarkdown(markdownInput: string): Promise<any> {
    // turn markdown to html
    // TODO: use marked extensions to enhance it
    const html = await marked.parse(markdownInput);
    return await this.processHTML(html);
  }

  async processHTML(htmlInput: string): Promise<any> {
    // turn html to prosemirror state
    return htmlToJson(transformHTML(htmlInput));
  }
}
