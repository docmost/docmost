import { IBaseProperty } from "@/features/base/types/base.types";
import { CellText } from "./cell-text";
import { CellNumber } from "./cell-number";
import { CellSelect } from "./cell-select";
import { CellStatus } from "./cell-status";
import { CellMultiSelect } from "./cell-multi-select";
import { CellDate } from "./cell-date";
import { CellCheckbox } from "./cell-checkbox";
import { CellUrl } from "./cell-url";
import { CellEmail } from "./cell-email";
import { CellPerson } from "./cell-person";
import { CellFile } from "./cell-file";
import { CellPage } from "./cell-page";
import { CellCreatedAt } from "./cell-created-at";
import { CellLastEditedAt } from "./cell-last-edited-at";
import { CellLastEditedBy } from "./cell-last-edited-by";
import { CellFormula } from "./cell-formula";

export type CellComponentProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

export const cellComponents: Record<
  string,
  React.ComponentType<CellComponentProps>
> = {
  text: CellText,
  number: CellNumber,
  select: CellSelect,
  status: CellStatus,
  multiSelect: CellMultiSelect,
  date: CellDate,
  checkbox: CellCheckbox,
  url: CellUrl,
  email: CellEmail,
  person: CellPerson,
  file: CellFile,
  page: CellPage,
  createdAt: CellCreatedAt,
  lastEditedAt: CellLastEditedAt,
  lastEditedBy: CellLastEditedBy,
  formula: CellFormula,
};

type CellRendererProps = CellComponentProps;

export function CellRenderer(props: CellRendererProps) {
  const Component = cellComponents[props.property.type];
  if (!Component) return null;
  return <Component {...props} />;
}
