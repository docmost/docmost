function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function definedKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter((key) => obj[key] !== undefined);
}

/**
 * Deep equality for cell values. Treats null/undefined/"" as equivalent
 * "empty", compares arrays by ordered content and plain objects by their
 * defined members regardless of key order.
 * Note: an empty array [] is a real value, distinct from "empty".
 */
export function cellValuesEqual(a: unknown, b: unknown): boolean {
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);

  if (!aArr && !bArr) {
    if (isEmpty(a) && isEmpty(b)) return true;
    if (isEmpty(a) !== isEmpty(b)) return false;
  }

  if (aArr || bArr) {
    if (!aArr || !bArr) return false;
    if (a.length !== b.length) return false;
    return a.every((x, i) => cellValuesEqual(x, b[i]));
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = definedKeys(a);
    const bKeys = definedKeys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (key) => b[key] !== undefined && cellValuesEqual(a[key], b[key]),
    );
  }

  return a === b;
}
