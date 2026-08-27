import { safeRedirectPath } from './sso.util';

describe('safeRedirectPath', () => {
  it('accepts a plain absolute path', () => {
    expect(safeRedirectPath('/home')).toBe('/home');
    expect(safeRedirectPath('/s/space/p/page?x=1#top')).toBe(
      '/s/space/p/page?x=1#top',
    );
  });

  it('rejects protocol-relative URLs that would leave the site', () => {
    expect(safeRedirectPath('//evil.com')).toBeNull();
  });

  it('rejects absolute URLs', () => {
    expect(safeRedirectPath('https://evil.com')).toBeNull();
    expect(safeRedirectPath('/redirect?to=https://evil.com')).toBeNull();
  });

  it('rejects scheme-like paths', () => {
    expect(safeRedirectPath('/javascript:alert(1)')).toBeNull();
  });

  it('rejects relative paths and empty input', () => {
    expect(safeRedirectPath('home')).toBeNull();
    expect(safeRedirectPath('')).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath(null)).toBeNull();
  });

  it('rejects paths containing whitespace or control characters', () => {
    expect(safeRedirectPath('/home\nSet-Cookie: x')).toBeNull();
    expect(safeRedirectPath('/home​')).toBeNull();
    expect(safeRedirectPath('/home\\evil')).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(safeRedirectPath(42)).toBeNull();
    expect(safeRedirectPath({})).toBeNull();
  });
});
