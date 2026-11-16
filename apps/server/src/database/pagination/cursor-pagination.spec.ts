import { BadRequestException } from '@nestjs/common';
import { defaultDecodeCursor, defaultEncodeCursor } from './cursor-pagination';

const FIELDS = ['position', 'id'] as any;
const encode = (text: string) => Buffer.from(text, 'utf8').toString('base64url');

describe('defaultDecodeCursor', () => {
  it('reads back what defaultEncodeCursor wrote', () => {
    const cursor = defaultEncodeCursor([
      ['position', 'a00001'],
      ['id', 'x'],
    ] as any);
    expect(defaultDecodeCursor(cursor, FIELDS)).toEqual({
      position: 'a00001',
      id: 'x',
    });
  });

  it.each([
    ['a field is missing', encode('position=a00001')],
    ['a field is extra', encode('position=a00001&id=x&more=1')],
    ['a field has another name', encode('position=a00001&other=x')],
    ['the fields are in another order', encode('id=x&position=a00001')],
    ['the text is not a cursor', 'not-a-cursor'],
    ['the text is empty', ''],
  ])('refuses a cursor when %s', (_label, cursor) => {
    expect(() => defaultDecodeCursor(cursor, FIELDS)).toThrow(
      new BadRequestException('Invalid cursor'),
    );
  });
});
