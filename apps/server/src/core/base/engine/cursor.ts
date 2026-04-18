import { BadRequestException } from '@nestjs/common';
import { SortBuild, TailKey } from './sort';

type ValueType = 'numeric' | 'date' | 'bool' | 'text';

// Hard cap on decoded cursor size so a tampered cursor can't force a large
// JSON parse. Real cursors are <1KB (a handful of field values).
const MAX_CURSOR_DECODED_BYTES = 4096;

/*
 * Null-safe cursor encoder. The previous encoder used a literal string
 * sentinel `__null__` for NULLs, which could collide with real cell
 * values. This encoder never sees NULL because sort expressions are
 * sentinel-wrapped (see sort.ts). It also represents ±Infinity
 * explicitly so JSON round-tripping is lossless.
 */

export function makeCursor(sorts: SortBuild[], tailKeys: TailKey[]) {
  const types = new Map<string, ValueType>();
  for (const s of sorts) types.set(s.key, s.valueType);
  for (const k of tailKeys) types.set(k, 'text');

  return {
    encodeCursor(values: Array<[string, unknown]>): string {
      const payload: Record<string, string> = {};
      for (const [k, v] of values) {
        payload[k] = encodeValue(v, types.get(k) ?? 'text');
      }
      return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    },

    decodeCursor(
      cursor: string,
      fieldNames: string[],
    ): Record<string, string> {
      let parsed: Record<string, string>;
      try {
        parsed = JSON.parse(
          Buffer.from(cursor, 'base64url').toString('utf8'),
        );
      } catch {
        throw new BadRequestException('Invalid cursor');
      }
      if (typeof parsed !== 'object' || parsed === null) {
        throw new BadRequestException('Invalid cursor payload');
      }
      const out: Record<string, string> = {};
      for (const name of fieldNames) {
        if (!(name in parsed)) {
          throw new BadRequestException(`Cursor missing field: ${name}`);
        }
        out[name] = parsed[name];
      }
      return out;
    },

    parseCursor(decoded: Record<string, string>): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      for (const [k, raw] of Object.entries(decoded)) {
        out[k] = decodeValue(raw, types.get(k) ?? 'text');
      }
      return out;
    },
  };
}

function encodeValue(value: unknown, type: ValueType): string {
  if (type === 'numeric') {
    if (value === null || value === undefined) return '';
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    if (n === Number.POSITIVE_INFINITY || String(value) === 'Infinity') {
      return 'inf';
    }
    if (n === Number.NEGATIVE_INFINITY || String(value) === '-Infinity') {
      return '-inf';
    }
    if (Number.isNaN(n)) return '';
    return String(n);
  }
  if (type === 'date') {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    const s = String(value);
    if (s === 'infinity') return 'inf';
    if (s === '-infinity') return '-inf';
    return s;
  }
  if (type === 'bool') {
    return value ? '1' : '0';
  }
  return value == null ? '' : String(value);
}

function decodeValue(raw: string, type: ValueType): unknown {
  if (type === 'numeric') {
    if (raw === 'inf') return Number.POSITIVE_INFINITY;
    if (raw === '-inf') return Number.NEGATIVE_INFINITY;
    if (raw === '') return null;
    return parseFloat(raw);
  }
  if (type === 'date') {
    if (raw === 'inf') return 'infinity';
    if (raw === '-inf') return '-infinity';
    if (raw === '') return null;
    return raw;
  }
  if (type === 'bool') {
    return raw === '1';
  }
  return raw;
}
