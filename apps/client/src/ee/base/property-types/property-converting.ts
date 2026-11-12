import type { IBaseProperty } from "@/ee/base/types/base.types";

export function isPropertyConverting(
  property: Pick<IBaseProperty, "pendingType" | "pendingTypeOptions">,
): boolean {
  return property.pendingType != null || property.pendingTypeOptions != null;
}
