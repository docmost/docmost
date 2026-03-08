import "@tanstack/react-table";
import { IBaseProperty } from "@/features/base/types/base.types";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    property?: IBaseProperty;
  }
}
