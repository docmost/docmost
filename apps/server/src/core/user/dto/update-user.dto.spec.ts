import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

const errorsFor = async (plain: Record<string, unknown>) =>
  validate(plainToInstance(UpdateUserDto, plain));

describe('UpdateUserDto', () => {
  it('accepts a valid IANA time zone', async () => {
    expect(await errorsFor({ timezone: 'Africa/Lagos' })).toHaveLength(0);
  });

  it('rejects an unknown time zone', async () => {
    const errors = await errorsFor({ timezone: 'Mars/Olympus' });
    expect(errors.map((e) => e.property)).toContain('timezone');
  });
});
