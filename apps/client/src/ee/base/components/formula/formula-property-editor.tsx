import { FormulaEditor } from "./formula-editor";
import { useBaseQuery } from "@/ee/base/queries/base-query";
import { useUpdatePropertyMutation } from "@/ee/base/queries/base-property-query";
import {
  IBaseProperty,
  FormulaTypeOptions,
  TypeOptions,
} from "@/ee/base/types/base.types";

type Props = {
  property: IBaseProperty;
  pageId: string;
  onClose: () => void;
};

export function FormulaPropertyEditor({ property, pageId, onClose }: Props) {
  const { data: base } = useBaseQuery(pageId);
  const updatePropertyMutation = useUpdatePropertyMutation();
  const opts = property.typeOptions as FormulaTypeOptions | undefined;

  return (
    <FormulaEditor
      properties={base?.properties ?? []}
      editingPropertyId={property.id}
      initialSource={opts?.source ?? ""}
      name={property.name}
      onCancel={onClose}
      onSave={(source, ast, resultType, dependencies) => {
        if (source === (opts?.source ?? "")) {
          onClose();
          return;
        }
        updatePropertyMutation.mutate({
          propertyId: property.id,
          pageId,
          typeOptions: {
            source,
            ast,
            resultType,
            dependencies,
            astVersion: 1,
          } as TypeOptions,
        });
        onClose();
      }}
    />
  );
}
