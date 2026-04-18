import { memo, useCallback, useEffect, useRef } from "react";
import { Header, flexRender } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Popover } from "@mantine/core";
import { useAtom } from "jotai";
import { IBaseRow, IBaseProperty, EditingCell } from "@/features/base/types/base.types";
import { activePropertyMenuAtom, propertyMenuDirtyAtom, propertyMenuCloseRequestAtom, editingCellAtom } from "@/features/base/atoms/base-atoms";
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
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import classes from "@/features/base/styles/grid.module.css";

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
};

export const GridHeaderCell = memo(function GridHeaderCell({
  header,
  property,
  loadedRowIds,
}: GridHeaderCellProps) {
  const isRowNumber = header.column.id === "__row_number";
  const isPinned = header.column.getIsPinned();
  const pinOffset = isPinned ? header.column.getStart("left") : undefined;
  const { selectionCount } = useRowSelection();
  const hasSelection = selectionCount > 0;

  const [activePropertyMenu, setActivePropertyMenu] = useAtom(activePropertyMenuAtom) as unknown as [string | null, (val: string | null) => void];
  const menuOpened = activePropertyMenu === header.column.id;
  const cellRef = useRef<HTMLDivElement>(null);
  const [propertyMenuDirty, setPropertyMenuDirty] = useAtom(propertyMenuDirtyAtom) as unknown as [boolean, (val: boolean) => void];
  const [closeRequest, setCloseRequest] = useAtom(propertyMenuCloseRequestAtom) as unknown as [number, (val: number) => void];
  const [, setEditingCell] = useAtom(editingCellAtom) as unknown as [EditingCell, (val: EditingCell) => void];

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setPropertyMenuDirty(dirty);
  }, [setPropertyMenuDirty]);

  const isSortableDisabled = isRowNumber || isPinned === "left";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: header.column.id,
    disabled: isSortableDisabled,
  });

  const combinedRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      (cellRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [setNodeRef],
  );

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

  // Mantine's built-in `closeOnEscape` only fires when focus is inside the
  // dropdown, but opening the property menu (clicking the header) leaves
  // focus on the header itself. Mirror the click-outside path: when dirty,
  // bump `propertyMenuCloseRequestAtom` so property-menu shows its
  // "Unsaved changes" confirmation panel; otherwise close directly.
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

  const sortableStyle = transform
    ? {
        transform: CSS.Transform.toString({
          ...transform,
          scaleX: 1,
          scaleY: 1,
        }),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }
    : {};

  return (
    <div
      ref={combinedRef}
      className={`${classes.headerCell} ${isPinned ? classes.headerCellPinned : ""} ${hasSelection ? classes.hasSelection : ""}`}
      style={{
        ...(isPinned ? { left: pinOffset } : {}),
        ...(isRowNumber ? {} : { cursor: "pointer" }),
        ...sortableStyle,
      }}
      onClick={handleHeaderClick}
      {...(isSortableDisabled ? {} : attributes)}
      {...(isSortableDisabled ? {} : listeners)}
    >
      {isRowNumber ? (
        <RowNumberHeaderCell loadedRowIds={loadedRowIds} />
      ) : (
        <div className={classes.headerCellContent}>
          {TypeIcon && (
            <TypeIcon size={14} className={classes.headerTypeIcon} />
          )}
          <span className={classes.headerCellName}>
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
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
            />
          </Popover.Dropdown>
        </Popover>
      )}
    </div>
  );
});
