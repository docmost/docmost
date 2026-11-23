import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { IsObject } from 'class-validator';
import { MaxBodyDepth } from '../decorators/max-body-depth.decorator';
import { BodyDepthValidationPipe } from './body-depth-validation.pipe';

class UnboundedDto {
  @IsObject()
  content: object;
}

@MaxBodyDepth(128)
class BoundedDto extends UnboundedDto {}

class InheritedDto extends BoundedDto {}

const nested = (depth: number): object =>
  JSON.parse('{"child":'.repeat(depth) + 'null' + '}'.repeat(depth));

describe('BodyDepthValidationPipe', () => {
  const pipe = new BodyDepthValidationPipe();
  const metadata = { type: 'body' as const, metatype: BoundedDto };
  const validation = new ValidationPipe({
    whitelist: true,
    stopAtFirstError: true,
    transform: true,
  });

  it('rejects deeply nested JSON before a recursive transformer can overflow', () => {
    expect(() => pipe.transform({ content: nested(5000) }, metadata)).toThrow(
      BadRequestException,
    );
  });

  it('protects derived DTOs and unknown fields before whitelist removal', () => {
    expect(() =>
      pipe.transform(
        { content: {}, ignored: nested(5000) },
        { type: 'body', metatype: InheritedDto },
      ),
    ).toThrow(BadRequestException);
  });

  it('preserves accepted objects without mutating, copying, or truncating them', () => {
    const input = { content: nested(127), ignored: [1, null, { x: 'ok' }] };
    const before = JSON.stringify(input);
    expect(pipe.transform(input, metadata)).toBe(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('keeps depth above the opt-in limit valid for unmarked DTOs', async () => {
    const input = { content: nested(256) };
    const unmarked = { type: 'body' as const, metatype: UnboundedDto };
    const result = await validation.transform(
      pipe.transform(input, unmarked),
      unmarked,
    );
    expect(result).toEqual(input);
  });

  it.each(['param', 'query', 'custom'] as const)(
    'leaves %s values outside the body-only contract',
    (type) => {
      const input = { content: nested(5000) };
      expect(pipe.transform(input, { type, metatype: BoundedDto })).toBe(input);
    },
  );

  it.each([undefined, null, 3, 'text', true])(
    'leaves primitive %p values to existing DTO validators',
    (input) => {
      expect(pipe.transform(input, metadata)).toBe(input);
    },
  );

  it('keeps the existing transformation of wide shallow arrays and unknown fields', async () => {
    const input = {
      content: {
        people: Array.from({ length: 10_000 }, (_, i) => ({ id: i })),
        date: { start: '2026-11-18' },
        text: '日\n\t😀'.repeat(5000),
      },
      ignored: nested(100),
    };
    const oldResult = await validation.transform(
      structuredClone(input),
      metadata,
    );
    const result = await validation.transform(
      pipe.transform(structuredClone(input), metadata),
      metadata,
    );
    expect(result).toEqual(oldResult);
    expect(result.content.people).toHaveLength(10_000);
    expect(result).not.toHaveProperty('ignored');
  });
});
