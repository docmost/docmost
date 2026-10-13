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
import { IBaseRow, IBaseProperty, EditingCell } from "@/ee/base/types/base.types";
import {
  activePropertyMenuAtomFamily,
  propertyMenuDirtyAtomFamily,
  propertyMenuCloseRequestAtomFamily,
  editingCellAtomFamily,
  activeFormulaEditorAtomFamily,
  FormulaEditorTarget,
} from "@/ee/base/atoms/base-atoms";
import { getDescriptor } from "@/ee/base/property-types/property-type.registry";
import { PropertyMenuContent } from "@/ee/base/components/property/property-menu";
import { FormulaPropertyEditor } from "@/ee/base/components/formula/formula-property-editor";
import { RowNumberHeaderCell } from "./row-number-header-cell";
import { BaseDropEdgeIndicator } from "./base-drop-edge-indicator";
import { useRowSelection } from "@/ee/base/hooks/use-row-selection";
import { useBaseEditable } from "@/ee/base/context/base-editable";
import classes from "@/ee/base/styles/grid.module.css";

export const COLUMN_DRAG_TYPE = "base-column";

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
  const { selectionCount, toggleAll } = useRowSelection(pageId);
  const hasSelection = selectionCount > 0;
  const editable = useBaseEditable();
  const isHeaderInteractive = editable && !!property && !isRowNumber;
  const isRowNumberHeaderInteractive =
    isRowNumber && editable && loadedRowIds.length > 0;

  const [activePropertyMenu, setActivePropertyMenu] = useAtom(activePropertyMenuAtomFamily(pageId)) as unknown as [string | null, (val: string | null) => void];
  const menuOpened = activePropertyMenu === header.column.id;
  const cellRef = useRef<HTMLDivElement>(null);
  const [propertyMenuDirty, setPropertyMenuDirty] = useAtom(propertyMenuDirtyAtomFamily(pageId)) as unknown as [boolean, (val: boolean) => void];
  const [closeRequest, setCloseRequest] = useAtom(propertyMenuCloseRequestAtomFamily(pageId)) as unknown as [number, (val: number) => void];
  const [, setEditingCell] = useAtom(editingCellAtomFamily(pageId)) as unknown as [EditingCell, (val: EditingCell) => void];
  const [activeFormulaEditor, setActiveFormulaEditor] = useAtom(
    activeFormulaEditorAtomFamily(pageId),
  ) as unknown as [FormulaEditorTarget, (val: FormulaEditorTarget) => void];

  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  const resizeIntentRef = useRef(false);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setPropertyMenuDirty(dirty);
  }, [setPropertyMenuDirty]);

  const isSortableDisabled = isRowNumber || !!isPinned || !editable;

  // onColumnReorder ultimately depends on React Query result objects
  // (activeView, base) via persistViewConfig, and their identity changes on
  // every cache invalidation (every WS-driven collab refresh). Holding the
  // callback in a ref keeps it out of the DnD effect's dep array so we don't
  // tear down and re-register the pragmatic-dnd adapter on every header cell
  // each time another user edits the base.
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
        canDrag: () => !resizeIntentRef.current,
        getInitialData: () => ({
          type: COLUMN_DRAG_TYPE,
          columnId: header.column.id,
          pageId,
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
    if (resizeIntentRef.current) {
      resizeIntentRef.current = false;
      return;
    }
    setEditingCell(null);
    if (!editable) return;
    if (!isRowNumber && property && !isDragging) {
      if (propertyMenuDirty && !menuOpened) return;
      setActivePropertyMenu(menuOpened ? null : header.column.id);
    }
  }, [editable, isRowNumber, property, isDragging, header.column.id, menuOpened, propertyMenuDirty, setActivePropertyMenu, setEditingCell]);

  const handleMenuClose = useCallback(() => {
    setActivePropertyMenu(null);
  }, [setActivePropertyMenu]);

  const handleEditFormula = useCallback(() => {
    if (!property) return;
    handleMenuClose();
    setActiveFormulaEditor({ propertyId: property.id, rowId: null });
  }, [property, handleMenuClose, setActiveFormulaEditor]);

  const closeFormulaEditor = useCallback(
    () => setActiveFormulaEditor(null),
    [setActiveFormulaEditor],
  );

  const formulaEditorOpen =
    !!property &&
    activeFormulaEditor?.propertyId === property.id &&
    activeFormulaEditor?.rowId === null;

  // A closed property menu can never hold unsaved changes. Saving a rename
  // must clear propertyMenuDirty; otherwise it stays stuck true and
  // handleHeaderClick refuses to reopen any property menu, making the menu
  // appear dead after the first save. Reset only on the open-to-closed
  // transition so a sibling header cell can't clear the flag while another
  // column's menu is mid-edit.
  const wasMenuOpenedRef = useRef(menuOpened);
  useEffect(() => {
    if (wasMenuOpenedRef.current && !menuOpened) {
      setPropertyMenuDirty(false);
    }
    wasMenuOpenedRef.current = menuOpened;
  }, [menuOpened, setPropertyMenuDirty]);

  const handleMenuOpenChange = useCallback(
    (next: boolean) => {
      if (next) return; // opening is driven by the atom, not Mantine
      if (propertyMenuDirty) {
        // Veto the close and route through the discard-confirm flow.
        setCloseRequest(closeRequest + 1);
      } else {
        handleMenuClose();
      }
    },
    [propertyMenuDirty, closeRequest, setCloseRequest, handleMenuClose],
  );

  const TypeIcon = property ? getDescriptor(property.type)?.icon : undefined;

  return (
    <div
      ref={cellRef}
      role="columnheader"
      tabIndex={isHeaderInteractive || isRowNumberHeaderInteractive ? 0 : undefined}
      aria-haspopup={isHeaderInteractive ? "menu" : undefined}
      aria-label={isRowNumberHeaderInteractive ? t("Select all loaded rows") : undefined}
      className={`${classes.headerCell} ${isPinned ? classes.headerCellPinned : ""} ${hasSelection ? classes.hasSelection : ""}`}
      style={{
        ...(isPinned
          ? ({ "--pin-offset": `${pinOffset}px` } as React.CSSProperties)
          : {}),
        ...(isRowNumber || !editable ? {} : { cursor: "pointer" }),
        opacity: isDragging ? 0.4 : 1,
      }}
      onPointerDown={() => {
        resizeIntentRef.current = false;
      }}
      onClick={handleHeaderClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (isRowNumber) {
            if (isRowNumberHeaderInteractive) toggleAll(loadedRowIds);
          } else {
            handleHeaderClick();
          }
        }
      }}
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
      {editable && header.column.getCanResize() && (
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
          onPointerDown={(e) => {
            resizeIntentRef.current = true;
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {closestEdge && <BaseDropEdgeIndicator edge={closestEdge} />}
      {editable && property && !isRowNumber && (
        <Popover
          opened={menuOpened}
          onChange={handleMenuOpenChange}
          onClose={handleMenuClose}
          position="bottom-start"
          shadow="md"
          width={260}
          trapFocus
          returnFocus
          withinPortal
          closeOnClickOutside
          closeOnEscape
        >
          <Popover.Target>
            <div className={classes.popoverAnchor} />
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
              onEditFormula={
                property.type === "formula" ? handleEditFormula : undefined
              }
              pageId={pageId}
            />
          </Popover.Dropdown>
        </Popover>
      )}
      {property && !isRowNumber && property.type === "formula" && (
        <Popover
          opened={formulaEditorOpen}
          onChange={(o) => {
            if (!o) closeFormulaEditor();
          }}
          position="bottom-start"
          width={460}
          shadow="md"
          withinPortal
          closeOnClickOutside
          closeOnEscape={false}
          trapFocus
        >
          <Popover.Target>
            <div className={classes.popoverAnchor} />
          </Popover.Target>
          <Popover.Dropdown
            p={0}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                e.preventDefault();
                closeFormulaEditor();
              }
            }}
            style={{ maxWidth: "calc(100vw - 32px)" }}
          >
            {formulaEditorOpen && (
              <FormulaPropertyEditor
                property={property}
                pageId={pageId}
                onClose={closeFormulaEditor}
              />
            )}
          </Popover.Dropdown>
        </Popover>
      )}
    </div>
  );
});
