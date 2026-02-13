import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import SpaceAbilityFactory from '../../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../../core/casl/interfaces/space-ability.type';
import { PageService } from '../../../core/page/services/page.service';
import { SpaceMemberService } from '../../../core/space/services/space-member.service';
import { SearchService } from '../../../core/search/search.service';
import { User, Workspace } from '@docmost/db/types/entity.types';
import {
  jsonToMarkdown,
  jsonToHtml,
} from '../../../collaboration/collaboration.util';

@Injectable()
export class McpToolsService {
  constructor(
    private pageRepo: PageRepo,
    private spaceRepo: SpaceRepo,
    private spaceMemberRepo: SpaceMemberRepo,
    private spaceAbility: SpaceAbilityFactory,
    private pageService: PageService,
    private spaceMemberService: SpaceMemberService,
    private searchService: SearchService,
  ) {}

  registerTools(
    server: McpServer,
    user: User,
    workspace: Workspace,
  ): void {
    this.registerSearchPages(server, user, workspace);
    this.registerGetPage(server, user, workspace);
    this.registerCreatePage(server, user, workspace);
    this.registerUpdatePage(server, user, workspace);
    this.registerListPages(server, user, workspace);
    this.registerListSpaces(server, user, workspace);
    this.registerGetSpace(server, user, workspace);
  }

  private registerSearchPages(
    server: McpServer,
    user: User,
    workspace: Workspace,
  ) {
    server.tool(
      'search_pages',
      'Search pages by text query across all accessible spaces',
      {
        query: z.string().describe('Search query text'),
        spaceId: z.string().optional().describe('Limit search to a specific space'),
        limit: z.number().optional().describe('Max results (default 25)'),
      },
      async ({ query, spaceId, limit }) => {
        const result = await this.searchService.searchPage(
          {
            query,
            spaceId,
            limit: limit || 25,
            offset: 0,
          },
          { userId: user.id, workspaceId: workspace.id },
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result.items, null, 2),
            },
          ],
        };
      },
    );
  }

  private registerGetPage(
    server: McpServer,
    user: User,
    _workspace: Workspace,
  ) {
    server.tool(
      'get_page',
      'Get page content. Returns markdown by default.',
      {
        pageId: z.string().describe('Page ID or slug ID'),
        format: z
          .enum(['markdown', 'html', 'json'])
          .optional()
          .describe('Content format (default: markdown)'),
      },
      async ({ pageId, format = 'markdown' }) => {
        const page = await this.pageRepo.findById(pageId, {
          includeContent: true,
          includeSpace: true,
        });

        if (!page) {
          return {
            content: [{ type: 'text' as const, text: 'Page not found' }],
            isError: true,
          };
        }

        const ability = await this.spaceAbility.createForUser(
          user,
          page.spaceId,
        );
        if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
          return {
            content: [{ type: 'text' as const, text: 'Access denied' }],
            isError: true,
          };
        }

        let contentOutput: any = page.content;
        if (format !== 'json' && page.content) {
          contentOutput =
            format === 'markdown'
              ? jsonToMarkdown(page.content)
              : jsonToHtml(page.content);
        }

        const text =
          typeof contentOutput === 'string'
            ? `# ${page.title || 'Untitled'}\n\n${contentOutput}`
            : JSON.stringify(
                { title: page.title, content: contentOutput },
                null,
                2,
              );

        return { content: [{ type: 'text' as const, text }] };
      },
    );
  }

  private registerCreatePage(
    server: McpServer,
    user: User,
    workspace: Workspace,
  ) {
    server.tool(
      'create_page',
      'Create a new page in a space',
      {
        spaceId: z.string().describe('Space ID to create the page in'),
        title: z.string().optional().describe('Page title'),
        content: z.string().optional().describe('Page content (markdown by default)'),
        format: z
          .enum(['markdown', 'html', 'json'])
          .optional()
          .describe('Content format (default: markdown)'),
        parentPageId: z.string().optional().describe('Parent page ID for nesting'),
      },
      async ({ spaceId, title, content, format, parentPageId }) => {
        const ability = await this.spaceAbility.createForUser(user, spaceId);
        if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
          return {
            content: [{ type: 'text' as const, text: 'Access denied' }],
            isError: true,
          };
        }

        const page = await this.pageService.create(user.id, workspace.id, {
          spaceId,
          title,
          content,
          format: content ? format || 'markdown' : undefined,
          parentPageId,
        } as any);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  id: page.id,
                  slugId: page.slugId,
                  title: page.title,
                  spaceId: page.spaceId,
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );
  }

  private registerUpdatePage(
    server: McpServer,
    user: User,
    _workspace: Workspace,
  ) {
    server.tool(
      'update_page',
      'Update page title and/or content',
      {
        pageId: z.string().describe('Page ID to update'),
        title: z.string().optional().describe('New page title'),
        content: z.string().optional().describe('New content (markdown by default)'),
        format: z
          .enum(['markdown', 'html', 'json'])
          .optional()
          .describe('Content format (default: markdown)'),
        operation: z
          .enum(['append', 'prepend', 'replace'])
          .optional()
          .describe('Content operation (default: replace)'),
      },
      async ({ pageId, title, content, format, operation }) => {
        const page = await this.pageRepo.findById(pageId, {
          includeContent: true,
        });
        if (!page) {
          return {
            content: [{ type: 'text' as const, text: 'Page not found' }],
            isError: true,
          };
        }

        const ability = await this.spaceAbility.createForUser(
          user,
          page.spaceId,
        );
        if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
          return {
            content: [{ type: 'text' as const, text: 'Access denied' }],
            isError: true,
          };
        }

        const updatedPage = await this.pageService.update(
          page,
          {
            pageId,
            title,
            content,
            format: content ? format || 'markdown' : undefined,
            operation: content ? operation || 'replace' : undefined,
          } as any,
          user,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { id: updatedPage.id, title: updatedPage.title },
                null,
                2,
              ),
            },
          ],
        };
      },
    );
  }

  private registerListPages(
    server: McpServer,
    user: User,
    _workspace: Workspace,
  ) {
    server.tool(
      'list_pages',
      'List pages in a space. Without pageId returns root pages; with pageId returns children of that page.',
      {
        spaceId: z.string().describe('Space ID'),
        pageId: z.string().optional().describe('Parent page ID to list children of'),
      },
      async ({ spaceId, pageId }) => {
        const ability = await this.spaceAbility.createForUser(user, spaceId);
        if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
          return {
            content: [{ type: 'text' as const, text: 'Access denied' }],
            isError: true,
          };
        }

        const result = await this.pageService.getSidebarPages(
          spaceId,
          { limit: 50 } as any,
          pageId,
        );

        const pages = result.items.map((p: any) => ({
          id: p.id,
          slugId: p.slugId,
          title: p.title,
          icon: p.icon,
          hasChildren: p.hasChildren,
          parentPageId: p.parentPageId,
        }));

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(pages, null, 2) },
          ],
        };
      },
    );
  }

  private registerListSpaces(
    server: McpServer,
    user: User,
    _workspace: Workspace,
  ) {
    server.tool(
      'list_spaces',
      'List all spaces accessible to the current user',
      {},
      async () => {
        const result = await this.spaceMemberService.getUserSpaces(
          user.id,
          { limit: 100 } as any,
        );

        const spaces = result.items.map((s: any) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          description: s.description,
        }));

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(spaces, null, 2) },
          ],
        };
      },
    );
  }

  private registerGetSpace(
    server: McpServer,
    user: User,
    workspace: Workspace,
  ) {
    server.tool(
      'get_space',
      'Get details about a specific space',
      {
        spaceId: z.string().describe('Space ID'),
      },
      async ({ spaceId }) => {
        const space = await this.spaceRepo.findById(spaceId, workspace.id);
        if (!space) {
          return {
            content: [{ type: 'text' as const, text: 'Space not found' }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  id: space.id,
                  name: space.name,
                  slug: space.slug,
                  description: space.description,
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );
  }
}
