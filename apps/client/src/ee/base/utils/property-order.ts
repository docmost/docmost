import { IBaseProperty } from "@/ee/base/types/base.types";

export function orderProperties(
  properties: IBaseProperty[],
  propertyOrder: string[] = [],
): IBaseProperty[] {
  return [
    ...propertyOrder
      .map((id) => properties.find((p) => p.id === id))
      .filter((p): p is IBaseProperty => p !== undefined),
    ...properties.filter((p) => !propertyOrder.includes(p.id)),
  ];
}
