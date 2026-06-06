// Isolate McpService from its dependency modules so the test does not pull in
// the collaboration/Yjs stack (ESM deps jest doesn't transform). We inject our
// own mocks anyway; these factories just prevent the real modules from loading.
jest.mock('../../core/search/search.service', () => ({ SearchService: class {} }));
jest.mock('../../core/page/services/page.service', () => ({ PageService: class {} }));
jest.mock('../../core/page/page-access/page-access.service', () => ({
  PageAccessService: class {},
}));
jest.mock('../../core/space/services/space-member.service', () => ({
  SpaceMemberService: class {},
}));
jest.mock('@docmost/db/repos/page/page.repo', () => ({ PageRepo: class {} }));
jest.mock('../../collaboration/collaboration.util', () => ({
  jsonToMarkdown: (json: unknown) => `# ${JSON.stringify(json)}`,
}));

import { McpService } from './mcp.service';

// MCP SDK is CJS-loaded (see mcp.service.ts for rationale)
/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
/* eslint-enable @typescript-eslint/no-require-imports */

describe('McpService', () => {
  const user = { id: 'u1', name: 'Svc', email: 'svc@example.com' } as any;
  const workspace = { id: 'w1', name: 'Acme' } as any;

  let searchService: any;
  let pageService: any;
  let pageRepo: any;
  let pageAccessService: any;
  let spaceMemberService: any;
  let spaceAbility: any;
  let service: McpService;

  async function connectClient() {
    const server = service.buildServer(user, workspace);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    return client;
  }

  beforeEach(() => {
    searchService = { searchPage: jest.fn().mockResolvedValue({ items: [] }) };
    pageService = {
      getRecentPages: jest.fn().mockResolvedValue({ items: [], meta: {} }),
      getRecentSpacePages: jest.fn().mockResolvedValue({ items: [], meta: {} }),
    };
    pageRepo = { findById: jest.fn() };
    pageAccessService = {
      validateCanView: jest.fn().mockResolvedValue(undefined),
      validateCanEdit: jest.fn().mockResolvedValue({ hasRestriction: false }),
    };
    spaceMemberService = {
      getUserSpaces: jest.fn().mockResolvedValue({ items: [], meta: {} }),
    };
    spaceAbility = {
      createForUser: jest
        .fn()
        .mockResolvedValue({ can: () => true, cannot: () => false }),
    };
    pageService.create = jest
      .fn()
      .mockResolvedValue({ id: 'new1', slugId: 'sl', title: 'New', spaceId: 's1' });
    pageService.update = jest
      .fn()
      .mockResolvedValue({ id: 'p1', title: 'Updated' });
    service = new McpService(
      searchService,
      pageService,
      pageRepo,
      pageAccessService,
      spaceMemberService,
      spaceAbility,
    );
  });

  it('registers the expected read and write tools', async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    const names = tools.map((t: any) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'get_current_user',
        'list_spaces',
        'search_pages',
        'get_page',
        'list_recent_pages',
        'create_page',
        'update_page',
      ]),
    );
  });

  it('get_current_user returns the authenticated identity', async () => {
    const client = await connectClient();
    const res = await client.callTool({
      name: 'get_current_user',
      arguments: {},
    });
    expect(res.content[0].text).toContain('svc@example.com');
    expect(res.content[0].text).toContain('Acme');
  });

  it('search_pages delegates to SearchService with user scope', async () => {
    searchService.searchPage.mockResolvedValue({ items: [{ id: 'p1' }] });
    const client = await connectClient();
    const res = await client.callTool({
      name: 'search_pages',
      arguments: { query: 'restart', spaceId: 's1' },
    });
    expect(searchService.searchPage).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'restart', spaceId: 's1' }),
      { userId: 'u1', workspaceId: 'w1' },
    );
    expect(res.content[0].text).toContain('p1');
  });

  it('get_page enforces view permission and returns markdown', async () => {
    pageRepo.findById.mockResolvedValue({
      id: 'p1',
      slugId: 'sl',
      title: 'Doc',
      content: null,
      spaceId: 's1',
    });
    const client = await connectClient();
    const res = await client.callTool({
      name: 'get_page',
      arguments: { pageId: 'p1' },
    });
    expect(pageAccessService.validateCanView).toHaveBeenCalled();
    expect(res.content[0].text).toContain('"id": "p1"');
  });

  it('create_page checks space permission then delegates to PageService', async () => {
    const client = await connectClient();
    const res = await client.callTool({
      name: 'create_page',
      arguments: { spaceId: 's1', title: 'New', content: '# Hi', format: 'markdown' },
    });
    expect(spaceAbility.createForUser).toHaveBeenCalledWith(user, 's1');
    expect(pageService.create).toHaveBeenCalledWith(
      'u1',
      'w1',
      expect.objectContaining({ spaceId: 's1', content: '# Hi', format: 'markdown' }),
    );
    expect(res.content[0].text).toContain('new1');
  });

  it('update_page enforces edit permission and replaces content', async () => {
    pageRepo.findById.mockResolvedValue({ id: 'p1', spaceId: 's1' });
    const client = await connectClient();
    const res = await client.callTool({
      name: 'update_page',
      arguments: { pageId: 'p1', content: '# New body' },
    });
    expect(pageAccessService.validateCanEdit).toHaveBeenCalled();
    expect(pageService.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
      expect.objectContaining({
        pageId: 'p1',
        content: '# New body',
        operation: 'replace',
        format: 'markdown',
      }),
      user,
    );
    expect(res.content[0].text).toContain('Updated');
  });
});
