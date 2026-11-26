import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchDTO, SearchSuggestionDTO } from './search.dto';

async function invalidFields(
  dto: ClassConstructor<object>,
  fields: object,
): Promise<string[]> {
  const instance = plainToInstance(dto, { query: 'roadmap', ...fields });
  const errors = await validate(instance);
  return errors.map((e) => e.property);
}

describe('SearchDTO paging', () => {
  it.each([-1, 0, 2.5, 101])('rejects limit %p', async (limit) => {
    expect(await invalidFields(SearchDTO, { limit })).toEqual(['limit']);
  });

  it.each([-1, 1.5, 201])('rejects offset %p', async (offset) => {
    expect(await invalidFields(SearchDTO, { offset })).toEqual(['offset']);
  });

  it('accepts a search without paging', async () => {
    expect(await invalidFields(SearchDTO, {})).toEqual([]);
  });

  it.each([
    [1, 0],
    [25, 100],
    [100, 200],
  ])('accepts limit %p with offset %p', async (limit, offset) => {
    expect(await invalidFields(SearchDTO, { limit, offset })).toEqual([]);
  });
});

describe('SearchSuggestionDTO limit', () => {
  it.each([-1, 0, 2.5, 101])('rejects limit %p', async (limit) => {
    expect(await invalidFields(SearchSuggestionDTO, { limit })).toEqual([
      'limit',
    ]);
  });

  it.each([1, 100])('accepts limit %p', async (limit) => {
    expect(await invalidFields(SearchSuggestionDTO, { limit })).toEqual([]);
  });

  it('accepts a suggestion without a limit', async () => {
    expect(await invalidFields(SearchSuggestionDTO, {})).toEqual([]);
  });
});
