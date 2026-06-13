import "@tanstack/react-table";
import { IBaseProperty } from "@/ee/base/types/base.types";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    property?: IBaseProperty;
  }
}
