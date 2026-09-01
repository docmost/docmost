import {
  assertAcyclicPageTraversal,
  PageHierarchyCycleError,
  stripPageTraversalMetadata,
} from './page-hierarchy-cycle';

describe('page hierarchy cycle contract', () => {
  it('does nothing when no row is marked as a cycle', () => {
    expect(() =>
      assertAcyclicPageTraversal(
        [
          { id: 'page-1', title: 'Root', isCycle: false },
          { id: 'page-2', title: 'Child', isCycle: false },
        ],
        'page-1',
      ),
    ).not.toThrow();
  });

  it('throws PageHierarchyCycleError when a row is marked as a cycle', () => {
    expect(() =>
      assertAcyclicPageTraversal(
        [{ id: 'page-1', title: 'Root', isCycle: true }],
        'page-1',
      ),
    ).toThrow(PageHierarchyCycleError);
  });

  it('keeps the root page id on the error for safe logging', () => {
    try {
      assertAcyclicPageTraversal(
        [{ id: 'page-1', title: 'Root', isCycle: true }],
        'root-page',
      );
      throw new Error('expected a cycle error');
    } catch (error) {
      expect(error).toBeInstanceOf(PageHierarchyCycleError);
      expect((error as PageHierarchyCycleError).rootPageId).toBe('root-page');
      expect((error as PageHierarchyCycleError).code).toBe('PAGE_HIERARCHY_CYCLE');
    }
  });

  it('removes traversal metadata without changing the public row fields', () => {
    const row = { id: 'page-1', title: 'Root', isCycle: false };

    expect(stripPageTraversalMetadata(row)).toEqual({ id: 'page-1', title: 'Root' });
  });
});
