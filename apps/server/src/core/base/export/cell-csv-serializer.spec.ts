import { serializeCellForCsv } from './cell-csv-serializer';
import { BasePropertyType } from '../base.schemas';

const p = (type: string, typeOptions: unknown = {}) => ({
  id: 'prop-1',
  type: type as any,
  typeOptions,
});

describe('serializeCellForCsv', () => {
  const userNames = new Map([
    ['u1', 'Alice'],
    ['u2', 'Bob'],
  ]);

  it('returns empty string for null/undefined', () => {
    expect(serializeCellForCsv(p(BasePropertyType.TEXT), null, {})).toBe('');
    expect(serializeCellForCsv(p(BasePropertyType.NUMBER), undefined, {})).toBe('');
  });

  it('stringifies text/url/email as-is', () => {
    expect(serializeCellForCsv(p(BasePropertyType.TEXT), 'hi', {})).toBe('hi');
    expect(serializeCellForCsv(p(BasePropertyType.URL), 'https://x', {})).toBe('https://x');
    expect(serializeCellForCsv(p(BasePropertyType.EMAIL), 'a@b.com', {})).toBe('a@b.com');
  });

  it('stringifies number', () => {
    expect(serializeCellForCsv(p(BasePropertyType.NUMBER), 42, {})).toBe('42');
    expect(serializeCellForCsv(p(BasePropertyType.NUMBER), 0, {})).toBe('0');
  });

  it('renders checkbox as true/false', () => {
    expect(serializeCellForCsv(p(BasePropertyType.CHECKBOX), true, {})).toBe('true');
    expect(serializeCellForCsv(p(BasePropertyType.CHECKBOX), false, {})).toBe('false');
  });

  it('resolves select/status choice name', () => {
    const prop = p(BasePropertyType.SELECT, {
      choices: [
        { id: 'c1', name: 'Red', color: 'red' },
        { id: 'c2', name: 'Green', color: 'green' },
      ],
    });
    expect(serializeCellForCsv(prop, 'c1', {})).toBe('Red');
    expect(serializeCellForCsv(prop, 'unknown', {})).toBe('');
  });

  it('joins multiSelect names with "; " preserving order', () => {
    const prop = p(BasePropertyType.MULTI_SELECT, {
      choices: [
        { id: 'c1', name: 'A', color: 'red' },
        { id: 'c2', name: 'B', color: 'blue' },
      ],
    });
    expect(serializeCellForCsv(prop, ['c2', 'c1'], {})).toBe('B; A');
  });

  it('resolves person scalar and array', () => {
    const prop = p(BasePropertyType.PERSON);
    expect(serializeCellForCsv(prop, 'u1', { userNames })).toBe('Alice');
    expect(serializeCellForCsv(prop, ['u1', 'u2', 'missing'], { userNames })).toBe(
      'Alice; Bob',
    );
  });

  it('joins file names from cell payload', () => {
    const prop = p(BasePropertyType.FILE);
    expect(
      serializeCellForCsv(
        prop,
        [
          { id: 'f1', fileName: 'a.pdf' },
          { id: 'f2', fileName: 'b.png' },
        ],
        {},
      ),
    ).toBe('a.pdf; b.png');
  });

  it('dates pass through as ISO strings', () => {
    const iso = '2026-04-18T12:00:00.000Z';
    expect(serializeCellForCsv(p(BasePropertyType.DATE), iso, {})).toBe(iso);
  });

  it('lastEditedBy resolves via userNames', () => {
    const prop = p(BasePropertyType.LAST_EDITED_BY);
    expect(serializeCellForCsv(prop, 'u2', { userNames })).toBe('Bob');
    expect(serializeCellForCsv(prop, 'missing', { userNames })).toBe('');
  });

  it('page resolves via pageTitles', () => {
    const pageTitles = new Map([
      ['p1', 'Launch plan'],
      ['p2', 'Retro notes'],
    ]);
    const prop = p(BasePropertyType.PAGE);
    expect(serializeCellForCsv(prop, 'p1', { pageTitles })).toBe('Launch plan');
    expect(serializeCellForCsv(prop, 'missing', { pageTitles })).toBe('');
    expect(serializeCellForCsv(prop, 'p1', {})).toBe('');
    expect(serializeCellForCsv(prop, 123, { pageTitles })).toBe('');
  });
});
