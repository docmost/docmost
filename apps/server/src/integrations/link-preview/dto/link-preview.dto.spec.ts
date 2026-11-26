import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LinkPreviewDto } from './link-preview.dto';

async function violations(input: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(LinkPreviewDto, input));
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe('LinkPreviewDto', () => {
  it('accepts an ordinary URL', async () => {
    expect(await violations({ url: 'https://example.com/a?b=c' })).toEqual([]);
  });

  it('rejects a URL containing whitespace', async () => {
    expect(await violations({ url: 'https://example.com/a b' })).toContain(
      'matches',
    );
  });

  it('rejects a URL containing a control character', async () => {
    expect(await violations({ url: 'https://example.com/a\x1b[31m' })).toContain(
      'matches',
    );
  });

  it('rejects a URL longer than 2048 characters', async () => {
    expect(
      await violations({ url: 'https://example.com/' + 'a'.repeat(2100) }),
    ).toContain('maxLength');
  });

  it('accepts refresh: true', async () => {
    expect(
      await violations({ url: 'https://example.com/', refresh: true }),
    ).toEqual([]);
  });

  it("rejects refresh: 'yes'", async () => {
    expect(
      await violations({ url: 'https://example.com/', refresh: 'yes' }),
    ).toContain('isBoolean');
  });
});
