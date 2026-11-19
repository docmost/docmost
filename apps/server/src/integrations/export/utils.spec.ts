import { buildTree, getSafePageTitle } from './utils';

const page = (title: string, parentPageId: string | null = null) =>
  ({ id: title, slugId: title, title, parentPageId }) as any;

function exportedPages(pages: any[]) {
  return Object.values(buildTree(pages)).flat();
}

const fileNames = (pages: any[]) =>
  exportedPages(pages).map((p) => getSafePageTitle(p.title));

describe('buildTree', () => {
  it('numbers a sibling whose title only differs in characters file names drop', () => {
    const pages = exportedPages([page('Plan: Q1'), page('Plan Q1')]);

    expect(pages.map((p) => p.title)).toEqual(['Plan: Q1', 'Plan Q1 (1)']);
    expect(pages.map((p) => getSafePageTitle(p.title))).toEqual([
      'Plan Q1',
      'Plan Q1 (1)',
    ]);
  });

  it('numbers a sibling whose title only differs in case', () => {
    expect(fileNames([page('Notes'), page('notes')])).toEqual([
      'Notes',
      'notes (1)',
    ]);
  });

  it('skips a number that a sibling already has in its title', () => {
    expect(
      fileNames([page('Notes'), page('Notes (1)'), page('Notes')]),
    ).toEqual(['Notes', 'Notes (1)', 'Notes (2)']);
  });

  it('leaves the same title alone under different parents', () => {
    expect(fileNames([page('Notes', 'a'), page('Notes', 'b')])).toEqual([
      'Notes',
      'Notes',
    ]);
  });

  it('keeps the number on a title too long for a file name', () => {
    const title = 'x'.repeat(300);

    expect(fileNames([page(title), page(title)])).toEqual([
      'x'.repeat(255),
      `${'x'.repeat(251)} (1)`,
    ]);
  });
});
