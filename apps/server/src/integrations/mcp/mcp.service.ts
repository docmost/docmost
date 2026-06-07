import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { SearchService } from '../../core/search/search.service';
import { PageService } from '../../core/page/services/page.service';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { SpaceMemberService } from '../../core/space/services/space-member.service';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { SearchDTO } from '../../core/search/dto/search.dto';
import { CreatePageDto } from '../../core/page/dto/create-page.dto';
import { UpdatePageDto } from '../../core/page/dto/update-page.dto';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { jsonToMarkdown } from '../../collaboration/collaboration.util';
import { LabelService } from '../../core/label/label.service';
import { LabelType } from '@docmost/db/repos/label/label.repo';
import { OrganizeService } from '../../core/organize/organize.service';
import { DedupService } from '../../core/dedup/dedup.service';

// The MCP SDK ships ESM + a CJS build but no flat `main`/type entry that the
// server's classic module resolution can follow, so load the CJS build via
// require (same pattern used for optional modules elsewhere in the codebase).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');

const SERVER_INFO = { name: 'docmost', version: '1.0.0' };

function toText(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text:
          typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

@Injectable()
export class McpService {
  constructor(
    private readonly searchService: SearchService,
    private readonly pageService: PageService,
    private readonly pageRepo: PageRepo,
    private readonly pageAccessService: PageAccessService,
    private readonly spaceMemberService: SpaceMemberService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly labelService: LabelService,
    private readonly organizeService: OrganizeService,
    private readonly dedupService: DedupService,
  ) {}

  /**
   * Builds a per-request MCP server whose tools execute as the given user,
   * reusing the same services (and permission checks) as the web app.
   */
  buildServer(user: User, workspace: Workspace) {
    const server = new McpServer(SERVER_INFO, {
      capabilities: { tools: {} },
    });

    server.registerTool(
      'get_current_user',
      {
        description:
          'Get the authenticated user and workspace associated with this API key.',
        inputSchema: {},
      },
      async () =>
        toText({
          user: { id: user.id, name: user.name, email: user.email },
          workspace: { id: workspace.id, name: workspace.name },
        }),
    );

    server.registerTool(
      'list_spaces',
      {
        description: 'List spaces the authenticated user can access.',
        inputSchema: { limit: z.number().min(1).max(100).optional() },
      },
      async ({ limit }: { limit?: number }) => {
        const pagination = new PaginationOptions();
        pagination.limit = limit ?? 50;
        const result = await this.spaceMemberService.getUserSpaces(
          user.id,
          pagination,
        );
        return toText(result);
      },
    );

    server.registerTool(
      'search_pages',
      {
        description:
          'Full-text search pages the user can access. Optionally scope to a spaceId.',
        inputSchema: {
          query: z.string().min(1),
          spaceId: z.string().optional(),
        },
      },
      async ({ query, spaceId }: { query: string; spaceId?: string }) => {
        const params = new SearchDTO();
        params.query = query;
        params.spaceId = spaceId;
        const result = await this.searchService.searchPage(params, {
          userId: user.id,
          workspaceId: workspace.id,
        });
        return toText(result);
      },
    );

    server.registerTool(
      'get_page',
      {
        description: 'Get a page by id, including its content rendered as markdown.',
        inputSchema: { pageId: z.string() },
      },
      async ({ pageId }: { pageId: string }) => {
        const page = await this.pageRepo.findById(pageId, {
          includeContent: true,
          includeSpace: true,
        });
        if (!page) {
          return toText({ error: 'Page not found' });
        }
        // throws if the user cannot view the page
        await this.pageAccessService.validateCanView(page, user);
        const markdown = page.content ? jsonToMarkdown(page.content) : '';
        return toText({
          id: page.id,
          slugId: page.slugId,
          title: page.title,
          icon: page.icon,
          spaceId: page.spaceId,
          parentPageId: page.parentPageId,
          markdown,
        });
      },
    );

    server.registerTool(
      'list_recent_pages',
      {
        description:
          'List recently updated pages, optionally scoped to a spaceId.',
        inputSchema: {
          spaceId: z.string().optional(),
          limit: z.number().min(1).max(100).optional(),
        },
      },
      async ({ spaceId, limit }: { spaceId?: string; limit?: number }) => {
        const pagination = new PaginationOptions();
        pagination.limit = limit ?? 20;
        const result = spaceId
          ? await this.pageService.getRecentSpacePages(
              spaceId,
              user.id,
              pagination,
            )
          : await this.pageService.getRecentPages(user.id, pagination);
        return toText(result);
      },
    );

    server.registerTool(
      'create_page',
      {
        description:
          'Create a page in a space. Provide content as markdown (default), html, or json. Optionally nest under parentPageId.',
        inputSchema: {
          spaceId: z.string(),
          title: z.string().optional(),
          parentPageId: z.string().optional(),
          content: z.string().optional(),
          format: z.enum(['markdown', 'html', 'json']).optional(),
        },
      },
      async ({
        spaceId,
        title,
        parentPageId,
        content,
        format,
      }: {
        spaceId: string;
        title?: string;
        parentPageId?: string;
        content?: string;
        format?: 'markdown' | 'html' | 'json';
      }) => {
        // permission checks mirror PageController.create
        if (parentPageId) {
          const parent = await this.pageRepo.findById(parentPageId);
          if (!parent || parent.deletedAt || parent.spaceId !== spaceId) {
            throw new NotFoundException('Parent page not found');
          }
          await this.pageAccessService.validateCanEdit(parent, user);
        } else {
          const ability = await this.spaceAbility.createForUser(user, spaceId);
          if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
            throw new ForbiddenException();
          }
        }

        const dto = new CreatePageDto();
        dto.spaceId = spaceId;
        dto.title = title;
        dto.parentPageId = parentPageId;
        if (content) {
          dto.content = content;
          dto.format = format ?? 'markdown';
        }

        const page = await this.pageService.create(user.id, workspace.id, dto);
        return toText({
          id: page.id,
          slugId: page.slugId,
          title: page.title,
          spaceId: page.spaceId,
          parentPageId: page.parentPageId,
        });
      },
    );

    server.registerTool(
      'update_page',
      {
        description:
          'Update a page title and/or replace its content. Content is markdown by default.',
        inputSchema: {
          pageId: z.string(),
          title: z.string().optional(),
          content: z.string().optional(),
          format: z.enum(['markdown', 'html', 'json']).optional(),
        },
      },
      async ({
        pageId,
        title,
        content,
        format,
      }: {
        pageId: string;
        title?: string;
        content?: string;
        format?: 'markdown' | 'html' | 'json';
      }) => {
        const page = await this.pageRepo.findById(pageId);
        if (!page) {
          throw new NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanEdit(page, user);

        const dto = new UpdatePageDto();
        dto.pageId = pageId;
        dto.title = title;
        if (content) {
          dto.content = content;
          dto.operation = 'replace';
          dto.format = format ?? 'markdown';
        }

        const updated = await this.pageService.update(page, dto, user);
        return toText({ id: updated.id, title: updated.title });
      },
    );

    // --- Organize / labels / dedup tools (Workstream D over MCP) ---

    server.registerTool(
      'list_labels',
      {
        description:
          'List the workspace label vocabulary (reuse these names when tagging).',
        inputSchema: { limit: z.number().min(1).max(100).optional() },
      },
      async ({ limit }: { limit?: number }) => {
        const pagination = new PaginationOptions();
        pagination.limit = limit ?? 50;
        const result = await this.labelService.getLabels(
          workspace.id,
          user.id,
          LabelType.PAGE,
          pagination,
        );
        return toText(result);
      },
    );

    server.registerTool(
      'add_page_labels',
      {
        description:
          'Tag a page. Pass label names; missing labels are created and attached.',
        inputSchema: {
          pageId: z.string(),
          names: z.array(z.string()).min(1),
        },
      },
      async ({ pageId, names }: { pageId: string; names: string[] }) => {
        const page = await this.pageRepo.findById(pageId);
        if (!page || page.deletedAt) {
          throw new NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanEdit(page, user);
        const labels = await this.labelService.addLabelsToPage(
          page.id,
          names,
          workspace.id,
        );
        return toText(labels);
      },
    );

    server.registerTool(
      'set_page_summary',
      {
        description: 'Store an agent-generated summary on a page.',
        inputSchema: { pageId: z.string(), summary: z.string() },
      },
      async ({ pageId, summary }: { pageId: string; summary: string }) => {
        const page = await this.pageRepo.findById(pageId);
        if (!page || page.deletedAt) {
          throw new NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanEdit(page, user);
        const dto = new UpdatePageDto();
        dto.pageId = page.id;
        dto.summary = summary;
        const updated = await this.pageService.update(page, dto, user);
        return toText({ id: updated.id, summary: updated.summary });
      },
    );

    server.registerTool(
      'dedup_analyze',
      {
        description:
          'Analyze pages for exact-duplicate content; returns clusters with a keep-oldest recommendation.',
        inputSchema: { spaceId: z.string().optional() },
      },
      async ({ spaceId }: { spaceId?: string }) => {
        if (spaceId) {
          const ability = await this.spaceAbility.createForUser(user, spaceId);
          if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
            throw new ForbiddenException();
          }
        }
        const result = await this.dedupService.analyze(workspace.id, spaceId);
        return toText(result);
      },
    );

    server.registerTool(
      'organize_create',
      {
        description:
          'Open an organize task to track progress; returns id, shareToken and statusUrl.',
        inputSchema: {
          spaceId: z.string().optional(),
          source: z.enum(['upload', 'code', 'manual']).optional(),
          title: z.string().optional(),
          total: z.number().min(0).optional(),
          fileTaskId: z.string().optional(),
        },
      },
      async (args: {
        spaceId?: string;
        source?: 'upload' | 'code' | 'manual';
        title?: string;
        total?: number;
        fileTaskId?: string;
      }) => {
        if (args.spaceId) {
          const ability = await this.spaceAbility.createForUser(
            user,
            args.spaceId,
          );
          if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
            throw new ForbiddenException();
          }
        }
        const task = await this.organizeService.create(
          user,
          workspace.id,
          args,
        );
        return toText(task);
      },
    );

    server.registerTool(
      'organize_report',
      {
        description:
          'Report one organize progress step (drives the live UI). countsAsProgress bumps completed.',
        inputSchema: {
          organizeTaskId: z.string(),
          step: z.string(),
          status: z.string().optional(),
          pageId: z.string().optional(),
          title: z.string().optional(),
          countsAsProgress: z.boolean().optional(),
        },
      },
      async (args: {
        organizeTaskId: string;
        step: string;
        status?: string;
        pageId?: string;
        title?: string;
        countsAsProgress?: boolean;
      }) => {
        const result = await this.organizeService.addEvent(workspace.id, args);
        return toText(result);
      },
    );

    server.registerTool(
      'organize_close',
      {
        description: 'Finalize an organize task (succeeded or failed).',
        inputSchema: {
          organizeTaskId: z.string(),
          status: z.enum(['succeeded', 'failed']).optional(),
          completed: z.number().min(0).optional(),
          error: z.string().optional(),
        },
      },
      async (args: {
        organizeTaskId: string;
        status?: 'succeeded' | 'failed';
        completed?: number;
        error?: string;
      }) => {
        const task = await this.organizeService.update(workspace.id, args);
        return toText(task);
      },
    );

    return server;
  }
}
