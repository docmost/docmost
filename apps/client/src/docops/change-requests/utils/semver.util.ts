export type BumpType = 'major' | 'minor' | 'patch';

export function bumpVersion(current: string, type: BumpType): string {
  const [major, minor, patch] = current.split('.').map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function isValidSemVer(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(v);
}
