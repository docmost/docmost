import { nodeIdFromConfluenceAnchor } from './confluence-anchor-id';

describe('nodeIdFromConfluenceAnchor', () => {
  it('is deterministic for the same (pageId, anchorName)', () => {
    const a = nodeIdFromConfluenceAnchor('page-1', 'My Anchor');
    const b = nodeIdFromConfluenceAnchor('page-1', 'My Anchor');
    expect(a).toBe(b);
  });

  it('returns different ids when the anchor name differs', () => {
    const a = nodeIdFromConfluenceAnchor('page-1', 'one');
    const b = nodeIdFromConfluenceAnchor('page-1', 'two');
    expect(a).not.toBe(b);
  });

  it('returns different ids when the pageId differs', () => {
    const a = nodeIdFromConfluenceAnchor('page-1', 'same');
    const b = nodeIdFromConfluenceAnchor('page-2', 'same');
    expect(a).not.toBe(b);
  });

  it('returns exactly 12 lowercase a-z characters', () => {
    const id = nodeIdFromConfluenceAnchor('page-xyz', 'Section · 1');
    expect(id).toHaveLength(12);
    expect(id).toMatch(/^[a-z]{12}$/);
  });

  it('treats an empty anchor name as a valid input', () => {
    const id = nodeIdFromConfluenceAnchor('page-1', '');
    expect(id).toMatch(/^[a-z]{12}$/);
  });
});
