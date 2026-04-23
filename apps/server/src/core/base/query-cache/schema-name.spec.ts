import { baseSchemaName } from './schema-name';

describe('baseSchemaName', () => {
  it('converts a uuid to a DuckDB-safe identifier with a b_ prefix', () => {
    expect(baseSchemaName('019c69a5-1d84-7985-a7f6-8ee2871d8669')).toBe(
      'b_019c69a51d847985a7f68ee2871d8669',
    );
  });

  it('rejects a non-uuid string (preserves the quoting contract)', () => {
    expect(() => baseSchemaName('not-a-uuid')).toThrow(/invalid base id/i);
    expect(() => baseSchemaName('')).toThrow(/invalid base id/i);
    expect(() => baseSchemaName('b_019c69a5; DROP TABLE rows; --')).toThrow(
      /invalid base id/i,
    );
  });

  it('is deterministic', () => {
    const id = '019c70b3-dd47-7014-8b87-ec8f167577ee';
    expect(baseSchemaName(id)).toBe(baseSchemaName(id));
  });

  it('accepts mixed-case hex and normalises to lowercase', () => {
    expect(baseSchemaName('019C69A5-1D84-7985-A7F6-8EE2871D8669')).toBe(
      'b_019c69a51d847985a7f68ee2871d8669',
    );
  });

  it('produces names that parse as SQL identifiers without quoting', () => {
    const name = baseSchemaName('019c69a5-1d84-7985-a7f6-8ee2871d8669');
    // Must match DuckDB's unquoted-identifier grammar: [a-zA-Z_][a-zA-Z0-9_]*
    expect(name).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
  });
});
