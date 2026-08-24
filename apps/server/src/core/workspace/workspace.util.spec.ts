import { BadRequestException } from '@nestjs/common';
import { normalizeTrustedOAuthClients } from './workspace.util';

describe('normalizeTrustedOAuthClients', () => {
  it('lowercases origins and trims names', () => {
    expect(
      normalizeTrustedOAuthClients([
        { origin: 'https://mcp.acme.com', name: '  Acme MCP  ' },
      ]),
    ).toEqual([{ origin: 'https://mcp.acme.com', name: 'Acme MCP' }]);
  });

  it('dedupes origins case-insensitively with the last entry winning', () => {
    expect(
      normalizeTrustedOAuthClients([
        { origin: 'https://mcp.acme.com', name: 'First' },
        { origin: 'https://mcp.acme.com', name: 'Second' },
      ]),
    ).toEqual([{ origin: 'https://mcp.acme.com', name: 'Second' }]);
  });

  it.each([
    ['http origin', 'http://mcp.acme.com'],
    ['trailing slash', 'https://mcp.acme.com/'],
    ['path suffix', 'https://mcp.acme.com/oauth'],
    ['uppercase host', 'https://MCP.acme.com'],
    ['not a url', 'mcp.acme.com'],
  ])('rejects %s naming the origin', (_label, origin) => {
    expect(() =>
      normalizeTrustedOAuthClients([{ origin, name: 'Acme MCP' }]),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizeTrustedOAuthClients([{ origin, name: 'Acme MCP' }]),
    ).toThrow(origin);
  });

  it.each([
    ['blank', '   '],
    ['too long', 'x'.repeat(65)],
  ])('rejects a %s name', (_label, name) => {
    expect(() =>
      normalizeTrustedOAuthClients([{ origin: 'https://mcp.acme.com', name }]),
    ).toThrow(BadRequestException);
  });

  it('returns an empty array for no entries', () => {
    expect(normalizeTrustedOAuthClients([])).toEqual([]);
  });
});
