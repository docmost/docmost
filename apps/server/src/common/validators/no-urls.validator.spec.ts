import { containsDomain } from './no-urls.validator';

// containsDomain returns true if value contains a domain-like pattern
// The full NoUrls validator also checks for https:// URLs separately

describe('containsDomain', () => {
  describe('bare domains with real TLDs — should block', () => {
    it.each([
      'example.com',
      'example.net',
      'example.org',
      'example.io',
      'example.co',
      'example.dev',
      'example.app',
      'example.me',
      'example.info',
      'example.tech',
      'example.aero',
      'example.cloud',
      'example.museum',
      'example.abc',
      'example.uk',
      'example.de',
      'example.fr',
      'example.ru',
    ])('blocks "%s"', (value) => {
      expect(containsDomain(value)).toBe(true);
    });
  });

  describe('domains with paths — should block', () => {
    it.each([
      'example.com/reset',
      'example.com/reset-password',
      'click example.com/page',
      'go to example.net/login',
    ])('blocks "%s"', (value) => {
      expect(containsDomain(value)).toBe(true);
    });
  });

  describe('multi-part domains — should block', () => {
    it.each([
      'Foo.com.net',
      'Foo.com.',
      'Foo.mine.net',
      'Foo.mine.ne',
      'sub.example.com',
      'login.example.co.uk',
    ])('blocks "%s"', (value) => {
      expect(containsDomain(value)).toBe(true);
    });
  });

  describe('domain in sentence — should block', () => {
    it.each([
      'Reset your password at example.com',
      'URGENT click example.com/reset',
      'Visit example.org for details',
      'go to mysite.io now',
    ])('blocks "%s"', (value) => {
      expect(containsDomain(value)).toBe(true);
    });
  });

  describe('case insensitive — should block', () => {
    it.each(['EXAMPLE.COM', 'Example.Com', 'example.COM'])('blocks "%s"', (value) => {
      expect(containsDomain(value)).toBe(true);
    });
  });

  describe('fake TLDs — should allow', () => {
    it.each([
      'Foo.mine',
      'Foo.blarg',
      'Foo.qqq',
      'Foo.zz',
      'Foo.abcd',
      'Foo.abcde',
      'Foo.abcdef',
      'Foo.abcdefg',
    ])('allows "%s"', (value) => {
      expect(containsDomain(value)).toBe(false);
    });
  });

  describe('too short suffix — should allow', () => {
    it.each(['Foo.a', 'Foo.c', 'A.B'])('allows "%s"', (value) => {
      expect(containsDomain(value)).toBe(false);
    });
  });

  describe('multi-part with fake TLD — should allow', () => {
    it.each(['Foo.mine.', 'Foo.mine.n'])('allows "%s"', (value) => {
      expect(containsDomain(value)).toBe(false);
    });
  });

  describe('emails — should allow', () => {
    it.each([
      'user@example.com',
      'admin@company.org',
      'test@sub.domain.co.uk',
    ])('allows "%s"', (value) => {
      expect(containsDomain(value)).toBe(false);
    });
  });

  describe('normal names — should allow', () => {
    it.each([
      'John Smith',
      'Dr. Smith',
      'A. B. Charlie',
      'John',
      'Mary Jane',
      "O'Brien",
      'Jean-Pierre',
      'José García',
    ])('allows "%s"', (value) => {
      expect(containsDomain(value)).toBe(false);
    });
  });

  describe('IP addresses — should allow', () => {
    it.each(['192.168.1.1', '10.0.0.1', '127.0.0.1'])(
      'allows "%s"',
      (value) => {
        expect(containsDomain(value)).toBe(false);
      },
    );
  });

  describe('edge cases — should allow', () => {
    it.each(['', ' ', '.', '..', 'hello', '.com', 'a.b'])(
      'allows "%s"',
      (value) => {
        expect(containsDomain(value)).toBe(false);
      },
    );
  });
});
