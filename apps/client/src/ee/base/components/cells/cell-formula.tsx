import { Badge, Tooltip } from "@mantine/core";
import {
  IBaseProperty,
  isFormulaErrorCell,
} from "@/ee/base/types/base.types";
import { CellText } from "./cell-text";
import { CellNumber } from "./cell-number";
import { CellCheckbox } from "./cell-checkbox";
import { CellDate } from "./cell-date";

type Props = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

export function CellFormula(props: Props) {
  const { value, property } = props;
  if (isFormulaErrorCell(value)) {
    return (
      <Tooltip label={`${value.__err}: ${value.msg}`}>
        <Badge color="red" variant="light" size="sm">
          #ERROR
        </Badge>
      </Tooltip>
    );
  }
  const opts = (property.typeOptions ?? {}) as { resultType?: string };
  const resultType = opts.resultType ?? "null";
  const readOnlyProps = { ...props, isEditing: false };
  if (resultType === "number") return <CellNumber {...readOnlyProps} />;
  if (resultType === "boolean") return <CellCheckbox {...readOnlyProps} />;
  if (resultType === "date") return <CellDate {...readOnlyProps} />;
  return <CellText {...readOnlyProps} />;
}
