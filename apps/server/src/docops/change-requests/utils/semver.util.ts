const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export function isValidSemVer(v: string): boolean {
  return SEMVER_RE.test(v);
}

export function isGreaterSemVer(next: string, current: string): boolean {
  const safeCurrentStr = isValidSemVer(current) ? current : '0.0.0';
  const [ma1, mi1, p1] = next.split('.').map(Number);
  const [ma2, mi2, p2] = safeCurrentStr.split('.').map(Number);
  if (ma1 !== ma2) return ma1 > ma2;
  if (mi1 !== mi2) return mi1 > mi2;
  return p1 > p2;
}
