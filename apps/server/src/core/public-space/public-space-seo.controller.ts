import { Controller, Get, Logger, Param, Req, Res } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { join } from 'path';
import * as fs from 'node:fs';
import { validate as isValidUUID } from 'uuid';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { Workspace } from '@docmost/db/types/entity.types';
import { htmlEscape } from '../../common/helpers/html-escaper';
import { PublicSpaceService } from './public-space.service';

@Controller('docs')
export class PublicSpaceSeoController {
  private readonly logger = new Logger(PublicSpaceSeoController.name);

  constructor(
    private readonly publicSpaceService: PublicSpaceService,
    private workspaceRepo: WorkspaceRepo,
    private environmentService: EnvironmentService,
  ) {}

  /*
   * The /docs hub: inject meta only when the directory is enabled;
   * otherwise the untouched SPA shell (uniform with 404s).
   */
  @Get()
  async getDirectoryHub(
    @Res({ passthrough: false }) res: FastifyReply,
    @Req() req: FastifyRequest,
  ) {
    const workspace = await this.resolveWorkspace(req);

    const clientDistPath = join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'client/dist',
    );
    if (!fs.existsSync(clientDistPath)) {
      return;
    }
    const indexFilePath = join(clientDistPath, 'index.html');

    if (!workspace) {
      return this.sendIndex(indexFilePath, res);
    }

    try {
      await this.publicSpaceService.getPublicSpaceDirectory(workspace);
    } catch (err) {
      return this.sendIndex(indexFilePath, res);
    }

    const metaTitle = 'Documentation';
    const metaTagVar = '<!--meta-tags-->';
    const metaTags = `<meta property="og:title" content="${metaTitle}" />`;

    const html = fs.readFileSync(indexFilePath, 'utf8');
    const transformedHtml = html
      .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${metaTitle}</title>`)
      .replace(metaTagVar, () => metaTags);

    res.type('text/html').send(transformedHtml);
  }

  /*
   * add meta tags to public space pages
   */
  @Get([':spaceSlug', ':spaceSlug/:pageSlug'])
  async getPublicSpacePage(
    @Res({ passthrough: false }) res: FastifyReply,
    @Req() req: FastifyRequest,
    @Param('spaceSlug') spaceSlug: string,
    @Param('pageSlug') pageSlug: string,
  ) {
    const workspace = await this.resolveWorkspace(req);

    const clientDistPath = join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'client/dist',
    );

    if (!fs.existsSync(clientDistPath)) {
      return;
    }
    const indexFilePath = join(clientDistPath, 'index.html');

    if (!workspace) {
      return this.sendIndex(indexFilePath, res);
    }

    let title: string = null;
    let searchIndexing = false;

    try {
      if (pageSlug) {
        const pageSlugId = this.extractPageSlugId(pageSlug);
        const pageData = await this.publicSpaceService.getPublicPage(
          spaceSlug,
          pageSlugId,
          workspace,
          { includeContent: false },
        );
        title = pageData.page?.title ?? pageData.space.name;
        searchIndexing = pageData.searchIndexing;
      } else {
        const info = await this.publicSpaceService.getPublicSpaceInfo(
          spaceSlug,
          workspace,
        );
        title = info.space.name;
        searchIndexing = info.searchIndexing;
      }
    } catch (err) {
      // Not public: serve the untouched SPA shell with zero injected meta.
      this.logger.debug(`no public meta for ${spaceSlug}`);
      return this.sendIndex(indexFilePath, res);
    }

    const rawTitle = htmlEscape(title ?? 'untitled');
    const metaTitle =
      rawTitle.length > 80 ? `${rawTitle.slice(0, 77)}…` : rawTitle;

    const metaTagVar = '<!--meta-tags-->';
    const metaTags = [
      `<meta property="og:title" content="${metaTitle}" />`,
      `<meta property="twitter:title" content="${metaTitle}" />`,
      !searchIndexing ? `<meta name="robots" content="noindex" />` : '',
    ]
      .filter(Boolean)
      .join('\n    ');

    const html = fs.readFileSync(indexFilePath, 'utf8');
    const transformedHtml = html
      .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${metaTitle}</title>`)
      .replace(metaTagVar, () => metaTags);

    res.type('text/html').send(transformedHtml);
  }

  // Prefix-excluded routes skip middleware, so resolve the workspace inline
  // exactly like ShareSeoController does.
  private async resolveWorkspace(req: FastifyRequest): Promise<Workspace> {
    if (this.environmentService.isSelfHosted()) {
      return this.workspaceRepo.findFirst();
    }
    const header = req.raw.headers.host;
    const subdomain = header.split('.')[0];
    return this.workspaceRepo.findByHostname(subdomain);
  }

  sendIndex(indexFilePath: string, res: FastifyReply) {
    const stream = fs.createReadStream(indexFilePath);
    res.type('text/html').send(stream);
  }

  extractPageSlugId(slug: string): string {
    if (!slug) {
      return undefined;
    }
    if (isValidUUID(slug)) {
      return slug;
    }
    const parts = slug.split('-');
    return parts.length > 1 ? parts[parts.length - 1] : slug;
  }
}
