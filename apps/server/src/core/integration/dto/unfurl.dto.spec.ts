import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UnfurlDto } from './integration.dto';

async function violations(url: string): Promise<string[]> {
  const errors = await validate(plainToInstance(UnfurlDto, { url }));
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe('UnfurlDto', () => {
  it('accepts an ordinary provider URL', async () => {
    expect(await violations('https://github.com/o/r/pulls?q=is%3Aopen')).toEqual([]);
  });

  it('rejects a URL longer than 8192 characters', async () => {
    expect(await violations('https://github.com/o/r/pulls?' + 'a'.repeat(9000))).toContain('maxLength');
  });

  it('rejects a URL containing whitespace', async () => {
    expect(await violations('https://github.com/o/r/pulls/' + '?'.repeat(100) + '\n')).toContain('matches');
  });

  it.each([
    ['an escape', '\x1b'],
    ['a NUL', '\x00'],
    ['a backspace', '\x08'],
    ['a unit separator', '\x1f'],
    ['a DEL', '\x7f'],
  ])('rejects a URL containing %s character', async (_label, char) => {
    expect(await violations(`https://github.com/o/r/pull/1${char}[31m`)).toContain('matches');
  });

  it('accepts non-ASCII characters in a URL', async () => {
    expect(await violations('https://docs.google.com/document/d/abc/edit#heading=été')).toEqual([]);
  });
});
