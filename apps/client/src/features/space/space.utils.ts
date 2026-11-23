import { ISpace } from "@/features/space/types/space.types";

export function includeSpace(
  spaces: ISpace[],
  space?: ISpace | null,
): ISpace[] {
  if (!space || spaces.some((item) => item.id === space.id)) return spaces;
  return [space, ...spaces];
}
