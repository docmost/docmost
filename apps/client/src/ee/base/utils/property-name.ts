import { IBaseProperty } from "@/ee/base/types/base.types";

export function getAvailablePropertyName(
  baseName: string,
  properties: IBaseProperty[] = [],
): string {
  const existing = new Set(properties.map((p) => p.name.trim().toLowerCase()));
  if (!existing.has(baseName.toLowerCase())) return baseName;
  for (let i = 1; i < 1000; i++) {
    const candidate = `${baseName} ${i}`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
  return `${baseName} ${Date.now()}`;
}
