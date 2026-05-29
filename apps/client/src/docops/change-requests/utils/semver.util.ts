export type BumpType = 'major' | 'minor' | 'patch';

export function isValidSemVer(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(v);
}

export function bumpVersion(current: string, type: BumpType): string {
  const parts = current.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return '1.0.0';
  const [major, minor, patch] = parts;
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function isGreaterSemVer(next: string, current: string): boolean {
  const safeCurrent = isValidSemVer(current) ? current : '0.0.0';
  const [ma1, mi1, p1] = next.split('.').map(Number);
  const [ma2, mi2, p2] = safeCurrent.split('.').map(Number);
  if (ma1 !== ma2) return ma1 > ma2;
  if (mi1 !== mi2) return mi1 > mi2;
  return p1 > p2;
}
