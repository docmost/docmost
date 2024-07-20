import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
    const fileBuffer = await file.toBuffer();
    const fileName = sanitize(file.filename).slice(0, 255).split('.')[0];
    const fileExtension = path.extname(file.filename).toLowerCase();
    const fileMimeType = file.mimetype;
    const fileContent = fileBuffer.toString();

    let prosemirrorState = null;
    let createdPage = null;

    if (fileExtension.endsWith('.md') && fileMimeType === 'text/markdown') {
      prosemirrorState = await this.processMarkdown(fileContent);
    }

    if (fileExtension.endsWith('.html') && fileMimeType === 'text/html') {
      prosemirrorState = await this.processHTML(fileContent);
    }

    if (!prosemirrorState) {
      const message = 'Unsupported file format or mime type';
      this.logger.error(message);
      throw new BadRequestException(message);
    }

    const { title, prosemirrorJson } =
      this.extractTitleAndRemoveHeading(prosemirrorState);

    const pageTitle = title || fileName;

    if (prosemirrorJson) {
      try {
        const pagePosition = await this.getNewPagePosition(spaceId);

        createdPage = await this.pageRepo.insertPage({
          slugId: generateSlugId(),
          title: pageTitle,
          content: prosemirrorJson,
          position: pagePosition,
          spaceId: spaceId,
          creatorId: userId,
          workspaceId: workspaceId,
          lastUpdatedById: userId,
        });
      } catch (err) {
        const message = 'Failed to create page';
        this.logger.error(message, err);
        throw new BadRequestException(message);
      }
    }

    return createdPage;
  }

  async processMarkdown(markdownInput: string): Promise<any> {
    // turn markdown to html
    const html = await marked.parse(markdownInput);
    return await this.processHTML(html);
  }

  async processHTML(htmlInput: string): Promise<any> {
    // turn html to prosemirror state
    return htmlToJson(transformHTML(htmlInput));
  }

  extractTitleAndRemoveHeading(prosemirrorState: any) {
    let title = null;

    if (
      prosemirrorState?.content?.length > 0 &&
      prosemirrorState.content[0].type === 'heading' &&
      prosemirrorState.content[0].attrs?.level === 1
    ) {
      title = prosemirrorState.content[0].content[0].text;

      // remove h1 header node from state
      prosemirrorState.content.shift();
    }

    return { title, prosemirrorJson: prosemirrorState };
  }

  async getNewPagePosition(spaceId: string): Promise<string> {
    const lastPage = await this.db
      .selectFrom('pages')
      .select(['id', 'position'])
      .where('spaceId', '=', spaceId)
      .orderBy('position', 'desc')
      .limit(1)
      .where('parentPageId', 'is', null)
      .executeTakeFirst();

    if (lastPage) {
      return generateJitteredKeyBetween(lastPage.position, null);
    } else {
      return generateJitteredKeyBetween(null, null);
    }
  }
}
