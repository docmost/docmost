import { load } from 'cheerio';
import { applyConfluenceMarginLeftIndent } from './confluence-indent';

function run(html: string): string {
  const $ = load(html);
  applyConfluenceMarginLeftIndent($, $.root());
  // cheerio's html() includes <html><body>; return the body's inner HTML so
  // tests can assert on the meaningful portion.
  return $('body').html() ?? $.html();
}

describe('applyConfluenceMarginLeftIndent', () => {
  describe('Confluence Cloud (30 px per level, max 6)', () => {
    it('maps 30/60/90/120/150/180 px to data-indent 1..6', () => {
      const html =
        '<p style="margin-left: 30.0px;">L1</p>' +
        '<p style="margin-left: 60.0px;">L2</p>' +
        '<p style="margin-left: 90.0px;">L3</p>' +
        '<p style="margin-left: 120.0px;">L4</p>' +
        '<p style="margin-left: 150.0px;">L5</p>' +
        '<p style="margin-left: 180.0px;">L6</p>';
      const out = run(html);
      expect(out).toContain('<p data-indent="1">L1</p>');
      expect(out).toContain('<p data-indent="2">L2</p>');
      expect(out).toContain('<p data-indent="3">L3</p>');
      expect(out).toContain('<p data-indent="4">L4</p>');
      expect(out).toContain('<p data-indent="5">L5</p>');
      expect(out).toContain('<p data-indent="6">L6</p>');
      expect(out).not.toContain('margin-left');
    });
  });

  describe('Confluence Data Center (40 px per level, no upper bound)', () => {
    it('maps 40/80/120/160/200/240 px to data-indent 1..6', () => {
      const html =
        '<p style="margin-left: 40.0px;">one</p>' +
        '<p style="margin-left: 80.0px;">two</p>' +
        '<p style="margin-left: 120.0px;">three</p>' +
        '<p style="margin-left: 160.0px;">four</p>' +
        '<p style="margin-left: 200.0px;">five</p>' +
        '<p style="margin-left: 240.0px;">six</p>';
      const out = run(html);
      expect(out).toContain('<p data-indent="1">one</p>');
      expect(out).toContain('<p data-indent="2">two</p>');
      expect(out).toContain('<p data-indent="3">three</p>');
      expect(out).toContain('<p data-indent="4">four</p>');
      expect(out).toContain('<p data-indent="5">five</p>');
      expect(out).toContain('<p data-indent="6">six</p>');
      expect(out).not.toContain('margin-left');
    });

    it('clamps DC levels above 8 down to 8', () => {
      const html =
        '<p style="margin-left: 320.0px;">L8</p>' +
        '<p style="margin-left: 360.0px;">L9</p>' +
        '<p style="margin-left: 600.0px;">L15</p>';
      const out = run(html);
      expect(out).toContain('<p data-indent="8">L8</p>');
      expect(out).toContain('<p data-indent="8">L9</p>');
      expect(out).toContain('<p data-indent="8">L15</p>');
    });
  });

  describe('headings', () => {
    it('handles indent on h1-h6 the same way as paragraphs', () => {
      const html =
        '<h1 style="margin-left: 30px;">a</h1>' +
        '<h6 style="margin-left: 90px;">b</h6>';
      const out = run(html);
      expect(out).toContain('<h1 data-indent="1">a</h1>');
      expect(out).toContain('<h6 data-indent="3">b</h6>');
    });
  });

  describe('style attribute handling', () => {
    it('strips margin-left but preserves other inline styles', () => {
      const html =
        '<p style="color: red; margin-left: 30px; font-weight: bold;">x</p>';
      const out = run(html);
      expect(out).toMatch(/<p style="color: red;\s+font-weight: bold;?" data-indent="1">x<\/p>/);
      expect(out).not.toContain('margin-left');
    });

    it('removes the style attribute entirely when only margin-left was set', () => {
      // Two values so GCD detection sees a real unit (60 px) instead of
      // collapsing to the lone value. The point of this test is the style
      // attribute being stripped, not the level number.
      const html =
        '<p style="margin-left: 60px;">x</p>' +
        '<p style="margin-left: 120px;">y</p>';
      const out = run(html);
      expect(out).toContain('<p data-indent="1">x</p>');
      expect(out).toContain('<p data-indent="2">y</p>');
      expect(out).not.toContain('style=');
    });
  });

  describe('scope and edge cases', () => {
    it('leaves elements without margin-left untouched', () => {
      const html = '<p>plain</p><h2>heading</h2>';
      const out = run(html);
      expect(out).toBe('<p>plain</p><h2>heading</h2>');
    });

    it('does not touch divs, spans, or list items', () => {
      const html =
        '<div style="margin-left: 30px;">div</div>' +
        '<li style="margin-left: 30px;">li</li>' +
        '<span style="margin-left: 30px;">span</span>';
      const out = run(html);
      expect(out).not.toContain('data-indent');
      expect(out).toContain('margin-left: 30px');
    });

    it('ignores zero, negative, and unparseable margin-left values', () => {
      const html =
        '<p style="margin-left: 0px;">zero</p>' +
        '<p style="margin-left: -30px;">neg</p>' +
        '<p style="margin-left: auto;">auto</p>';
      const out = run(html);
      expect(out).not.toContain('data-indent');
    });

    it('honors an explicit pxPerLevel override', () => {
      // Mixed Cloud-and-DC nominal values forced to 40 px/level interpretation.
      const $ = load(
        '<p style="margin-left: 40px;">a</p>' +
          '<p style="margin-left: 80px;">b</p>',
      );
      applyConfluenceMarginLeftIndent($, $.root(), { pxPerLevel: 40 });
      const out = $('body').html() ?? '';
      expect(out).toContain('<p data-indent="1">a</p>');
      expect(out).toContain('<p data-indent="2">b</p>');
    });

    it('returns a no-op when no indented elements are present', () => {
      const html = '<p>hi</p>';
      const out = run(html);
      expect(out).toBe('<p>hi</p>');
    });

    it('handles a single ambiguous value by clamping to level 1', () => {
      // GCD of a single value is the value itself, so 120 / 120 = 1.
      const html = '<p style="margin-left: 120px;">only</p>';
      const out = run(html);
      expect(out).toContain('<p data-indent="1">only</p>');
    });
  });
});
