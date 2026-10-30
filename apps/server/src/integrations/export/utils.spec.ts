jest.mock('src/collaboration/collaboration.util', () => ({}));
jest.mock('../../common/helpers/prosemirror/utils', () => ({}));
jest.mock('../../common/helpers', () =>
  jest.requireActual('../../common/helpers/utils'),
);
jest.mock('uuid', () => ({ validate: jest.fn() }));

import { buildTree, computeLocalPath } from './utils';
import { Page } from '@docmost/db/types/entity.types';

const pages = (titles: string[], parentPageId: string | null = null) =>
  titles.map((title, index) => ({
    id: `page-${index}`,
    slugId: `slug-${index}`,
    parentPageId,
    title,
  })) as Page[];

const paths = (items: Page[]) => {
  const result: Record<string, string> = {};
  computeLocalPath(buildTree(items), 'markdown', null, '', result);
  return Object.values(result);
};

describe('export page filenames', () => {
  it('keeps unique filenames unchanged', () => {
    expect(paths(pages(['Plan A', 'Cà phê']))).toEqual([
      'Plan%20A.md',
      'C%C3%A0%20ph%C3%AA.md',
    ]);
  });

  it('keeps the existing suffix for identical titles', () => {
    expect(paths(pages(['Plan', 'Plan']))).toEqual([
      'Plan.md',
      'Plan%20(1).md',
    ]);
  });

  it.each([
    ['Plan: final', 'Plan final'],
    ['?', '*'],
    ['Plan', 'Plan', 'Plan (1)'],
  ])('assigns distinct paths after sanitizing %j', (...titles) => {
    const result = paths(pages(titles));
    expect(new Set(result).size).toBe(titles.length);
  });

  it.each(['a'.repeat(255), '日'.repeat(100)])(
    'keeps the suffix when long filenames are truncated',
    (title) => {
      const result = paths(pages([title, title]));
      expect(new Set(result).size).toBe(2);
      for (const filePath of result) {
        expect(decodeURIComponent(filePath)).not.toContain('\uFFFD');
      }
    },
  );

  it('keeps child paths separate when parent filenames collide', () => {
    const parents = pages(['Plan: final', 'Plan final']);
    const children = parents.map((parent, index) => ({
      ...pages(['Details'], parent.id)[0],
      id: `child-${index}`,
      slugId: `child-${index}`,
    }));
    const result = paths([...parents, ...children]);
    expect(new Set(result).size).toBe(4);
    expect(result).toContain('Plan%20final/Details.md');
    expect(result).toContain('Plan%20final%20(1)/Details.md');
  });
});
