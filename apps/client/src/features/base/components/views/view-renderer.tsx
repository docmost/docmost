import { Table } from "@tanstack/react-table";
import {
  IBase,
  IBaseRow,
  IBaseView,
} from "@/features/base/types/base.types";
import { BaseTable } from "@/features/base/components/base-table";
import { BaseKanban } from "@/features/base/components/views/kanban/base-kanban";

type ViewRendererProps = {
  base: IBase;
  rows: IBaseRow[];
  effectiveView: IBaseView | undefined;
  table: Table<IBaseRow>;
  pageId: string;
  embedded?: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onFetchNextPage: () => void;
  onCellUpdate: (rowId: string, propertyId: string, value: unknown) => void;
  onAddRow: () => void;
  onColumnReorder: (columnId: string, finishIndex: number) => void;
  onResizeEnd: () => void;
  onRowReorder: (
    rowId: string,
    targetRowId: string,
    dropPosition: "above" | "below",
  ) => void;
  onCardClick: (rowId: string) => void;
  persistViewConfig: () => void;
  scrollportRef: React.RefObject<HTMLDivElement>;
  stickyBandPrelude?: React.ReactNode;
};

export function ViewRenderer(props: ViewRendererProps) {
  const viewType = props.effectiveView?.type ?? "table";

  if (viewType === "kanban") {
    return (
      <BaseKanban
        base={props.base}
        rows={props.rows}
        effectiveView={props.effectiveView}
        onCardClick={props.onCardClick}
      />
    );
  }

  return <BaseTable {...props} />;
}
