function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

/**
 * Deep equality for cell values. Treats null/undefined/"" as equivalent
 * "empty", compares arrays by ordered content, objects by serialized form.
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

  if (typeof a === "object" && typeof b === "object" && a && b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return a === b;
}
