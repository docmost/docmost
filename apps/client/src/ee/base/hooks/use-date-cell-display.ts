import { useTranslation } from "react-i18next";
import {
  dateKindOfProperty,
  type DateCell,
  type DateKind,
} from "@docmost/base-formula/client";
import { IBaseProperty } from "@/ee/base/types/base.types";
import { useViewerDateContext } from "@/ee/base/hooks/use-viewer-date-context";
import { readDateCell } from "@/ee/base/utils/date-cell";
import { dateTypeOptionsOf, formatDateCell } from "@/ee/base/utils/date-format";

export function useDateCellDisplay(
  property: IBaseProperty,
  value: unknown,
): { kind: DateKind | null; cell: DateCell | null; text: string } {
  const { i18n } = useTranslation();
  const { timeZone, today } = useViewerDateContext();
  const kind = dateKindOfProperty(property.type, property.typeOptions);
  const cell = kind ? readDateCell(value, kind) : null;
  const { dateFormat, timeFormat } =
    property.type === "date" ? dateTypeOptionsOf(property.typeOptions) : {};
  const text = formatDateCell(cell, {
    dateFormat,
    timeFormat,
    locale: i18n.language,
    timeZone,
    today,
  });
  return { kind, cell, text };
}
