import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Header, flexRender } from "@tanstack/react-table";
import { Badge, Popover } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { triggerPostMoveFlash } from "@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash";
import * as liveRegion from "@atlaskit/pragmatic-drag-and-drop-live-region";
import { IBaseRow, IBaseProperty, EditingCell } from "@/features/base/types/base.types";
import {
  activePropertyMenuAtomFamily,
  propertyMenuDirtyAtomFamily,
  propertyMenuCloseRequestAtomFamily,
  editingCellAtomFamily,
} from "@/features/base/atoms/base-atoms";
import {
  IconLetterT,
  IconHash,
  IconCircleDot,
  IconProgressCheck,
  IconTags,
  IconCalendar,
  IconUser,
  IconPaperclip,
  IconCheckbox,
  IconLink,
  IconMail,
  IconClockPlus,
  IconClockEdit,
  IconUserEdit,
} from "@tabler/icons-react";
import { PropertyMenuContent } from "@/features/base/components/property/property-menu";
import { RowNumberHeaderCell } from "./row-number-header-cell";
import { BaseDropEdgeIndicator } from "./base-drop-edge-indicator";
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import classes from "@/features/base/styles/grid.module.css";

const COLUMN_DRAG_TYPE = "base-column";

const typeIcons: Record<string, typeof IconLetterT> = {
  text: IconLetterT,
  number: IconHash,
  select: IconCircleDot,
  status: IconProgressCheck,
  multiSelect: IconTags,
  date: IconCalendar,
  person: IconUser,
  file: IconPaperclip,
  checkbox: IconCheckbox,
  url: IconLink,
  email: IconMail,
  createdAt: IconClockPlus,
  lastEditedAt: IconClockEdit,
  lastEditedBy: IconUserEdit,
};

type GridHeaderCellProps = {
  header: Header<IBaseRow, unknown>;
  property: IBaseProperty | undefined;
  loadedRowIds: string[];
  pageId: string;
  getColumnOrder: () => string[];
  onColumnReorder?: (columnId: string, finishIndex: number) => void;
};

export const GridHeaderCell = memo(function GridHeaderCell({
  header,
  property,
  loadedRowIds,
  pageId,
  getColumnOrder,
  onColumnReorder,
}: GridHeaderCellProps) {
  const { t } = useTranslation();
  const isRowNumber = header.column.id === "__row_number";
  const isPinned = header.column.getIsPinned();
  const pinOffset = isPinned ? header.column.getStart("left") : undefined;
  const { selectionCount } = useRowSelection(pageId);
  const hasSelection = selectionCount > 0;

  const [activePropertyMenu, setActivePropertyMenu] = useAtom(activePropertyMenuAtomFamily(pageId)) as unknown as [string | null, (val: string | null) => void];
  const menuOpened = activePropertyMenu === header.column.id;
  const cellRef = useRef<HTMLDivElement>(null);
  const [propertyMenuDirty, setPropertyMenuDirty] = useAtom(propertyMenuDirtyAtomFamily(pageId)) as unknown as [boolean, (val: boolean) => void];
  const [closeRequest, setCloseRequest] = useAtom(propertyMenuCloseRequestAtomFamily(pageId)) as unknown as [number, (val: number) => void];
  const [, setEditingCell] = useAtom(editingCellAtomFamily(pageId)) as unknown as [EditingCell, (val: EditingCell) => void];

  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setPropertyMenuDirty(dirty);
  }, [setPropertyMenuDirty]);

  const isSortableDisabled = isRowNumber || !!isPinned;

  // onColumnReorder ultimately depends on React Query result objects
  // (activeView, base) via persistViewConfig — their identity changes on
  // every cache invalidation (i.e. every WS-driven collab refresh). Holding
  // the callback in a ref keeps it out of the DnD effect's dep array, so
  // we don't tear down and re-register the pragmatic-dnd adapter on every
  // header cell each time another user edits the base.
  const onColumnReorderRef = useRef(onColumnReorder);
  useLayoutEffect(() => {
    onColumnReorderRef.current = onColumnReorder;
  });

  useEffect(() => {
    const el = cellRef.current;
    if (!el || isSortableDisabled) return;
    return combine(
      draggable({
        element: el,
        getInitialData: () => ({
          type: COLUMN_DRAG_TYPE,
          columnId: header.column.id,
        }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) =>
          source.data.type === COLUMN_DRAG_TYPE &&
          source.data.columnId !== header.column.id,
        getData: ({ input, element }) =>
          attachClosestEdge(
            { columnId: header.column.id },
            { input, element, allowedEdges: ["left", "right"] },
          ),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ source, self }) => {
          setClosestEdge(null);
          const edge = extractClosestEdge(self.data);
          if (!edge) return;
          const order = getColumnOrder();
          const startIndex = order.indexOf(source.data.columnId as string);
          const indexOfTarget = order.indexOf(header.column.id);
          if (startIndex === -1 || indexOfTarget === -1) return;
          const finishIndex = getReorderDestinationIndex({
            startIndex,
            indexOfTarget,
            closestEdgeOfTarget: edge,
            axis: "horizontal",
          });
          if (finishIndex === startIndex) return;
          onColumnReorderRef.current?.(source.data.columnId as string, finishIndex);
          triggerPostMoveFlash(el);
          liveRegion.announce(`Moved column to position ${finishIndex + 1}`);
        },
      }),
    );
  }, [header.column.id, isSortableDisabled, getColumnOrder]);

  const handleHeaderClick = useCallback(() => {
    setEditingCell(null);
    if (!isRowNumber && property && !isDragging) {
      if (propertyMenuDirty && !menuOpened) return;
      setActivePropertyMenu(menuOpened ? null : header.column.id);
    }
  }, [isRowNumber, property, isDragging, header.column.id, menuOpened, propertyMenuDirty, setActivePropertyMenu, setEditingCell]);

  const handleMenuClose = useCallback(() => {
    setActivePropertyMenu(null);
  }, [setActivePropertyMenu]);

  useEffect(() => {
    if (!menuOpened) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (propertyMenuDirty) {
        setCloseRequest(closeRequest + 1);
      } else {
        handleMenuClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpened, propertyMenuDirty, closeRequest, setCloseRequest, handleMenuClose]);

  const TypeIcon = property ? typeIcons[property.type] : undefined;

  return (
    <div
      ref={cellRef}
      className={`${classes.headerCell} ${isPinned ? classes.headerCellPinned : ""} ${hasSelection ? classes.hasSelection : ""}`}
      style={{
        ...(isPinned
          ? ({ "--pin-offset": `${pinOffset}px` } as React.CSSProperties)
          : {}),
        ...(isRowNumber ? {} : { cursor: "pointer" }),
        opacity: isDragging ? 0.4 : 1,
      }}
      onClick={handleHeaderClick}
      data-dragging={isDragging || undefined}
    >
      {isRowNumber ? (
        <RowNumberHeaderCell loadedRowIds={loadedRowIds} pageId={pageId} />
      ) : (
        <div className={classes.headerCellContent}>
          {TypeIcon && (
            <TypeIcon size={14} className={classes.headerTypeIcon} />
          )}
          <span className={classes.headerCellName}>
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
          {property?.pendingType && (
            <Badge size="xs" color="gray" variant="light" ml={6}>
              {t("Converting…")}
            </Badge>
          )}
        </div>
      )}
      {header.column.getCanResize() && (
        <div
          className={`${classes.resizeHandle} ${
            header.column.getIsResizing() ? classes.resizeHandleActive : ""
          }`}
          onMouseDown={(e) => {
            e.stopPropagation();
            header.getResizeHandler()(e);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            header.getResizeHandler()(e);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {closestEdge && <BaseDropEdgeIndicator edge={closestEdge} />}
      {property && !isRowNumber && (
        <Popover
          opened={menuOpened}
          onClose={handleMenuClose}
          position="bottom-start"
          shadow="md"
          width={260}
          withinPortal
          closeOnClickOutside={false}
        >
          <Popover.Target>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
          </Popover.Target>
          <Popover.Dropdown
            p={0}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <PropertyMenuContent
              property={property}
              opened={menuOpened}
              onClose={handleMenuClose}
              onDirtyChange={handleDirtyChange}
              pageId={pageId}
            />
          </Popover.Dropdown>
        </Popover>
      )}
    </div>
  );
});
