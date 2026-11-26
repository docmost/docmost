import type { CellComponentProps } from "@/ee/base/property-types/property-type.descriptor";
import type { RelationTypeOptions } from "@/ee/base/types/base.types";
import { RelationReadList } from "@/ee/base/components/cells/relation-read-list";

export function CellRelation({ property, relation }: CellComponentProps) {
  const { targetBaseId } = property.typeOptions as RelationTypeOptions;
  return <RelationReadList preview={relation} targetBaseId={targetBaseId} />;
}
