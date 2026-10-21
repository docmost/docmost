import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePageDto } from './update-page.dto';

describe('UpdatePageDto', () => {
  it('defaults format to json when content is sent without one', async () => {
    const dto = plainToInstance(UpdatePageDto, {
      pageId: '0199f2a4-8c1e-7b3a-9d4e-2f6a8b1c3d5e',
      content: { type: 'doc', content: [] },
      operation: 'replace',
    });
    const errors = await validate(dto);

    expect(errors.flatMap((e) => Object.keys(e.constraints ?? {}))).toEqual([]);
    expect(dto.format).toBe('json');
  });
});
