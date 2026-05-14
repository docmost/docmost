import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { useFloating, offset, autoUpdate, hide } from "@floating-ui/react";
import { Menu } from "@mantine/core";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useTableHandleDrag } from "./hooks/use-table-handle-drag";
import { useColumnRowMenuLifecycle } from "./hooks/use-column-row-menu-lifecycle";
import { ColumnHandleMenu } from "./menus/column-handle-menu";
import classes from "./handle.module.css";

interface ColumnHandleProps {
  editor: Editor;
  index: number;
  anchorPos: number;
  tableNode: ProseMirrorNode;
  tablePos: number;
}

export const ColumnHandle = React.memo(function ColumnHandle({
  editor,
  index,
  anchorPos,
  tableNode,
  tablePos,
}: ColumnHandleProps) {
  const { t } = useTranslation();
  // Hold the cell DOM in a ref-backed state so we never unmount the handle
  // mid-drag. A remote edit can transiently flip `nodeDOM(anchorPos)` to null
  // (the plugin re-emits `hoveringCell` with the mapped pos a tick later);
  // unmounting the source element here would make pragmatic-dnd silently
  // abort the active drag.
  // `nodeDOM` is typed as `Node | null` — when `anchorPos` goes stale (e.g.
  // an external drop reflows the doc before the plugin re-emits
  // hoveringCell), it can resolve to a Text node, on which `.closest` is
  // undefined. Filter to HTMLElement so downstream consumers stay safe.
  const lookupDom = editor.view.nodeDOM(anchorPos);
  const lookupCellDom = lookupDom instanceof HTMLElement ? lookupDom : null;
  const [cellDom, setCellDom] = useState<HTMLElement | null>(lookupCellDom);
  const lastCellDomRef = useRef<HTMLElement | null>(lookupCellDom);
  useEffect(() => {
    if (lookupCellDom && lookupCellDom !== lastCellDomRef.current) {
      lastCellDomRef.current = lookupCellDom;
      setCellDom(lookupCellDom);
    }
  }, [lookupCellDom]);

  const [handleEl, setHandleEl] = useState<HTMLDivElement | null>(null);

  const { refs, floatingStyles, middlewareData } = useFloating({
    placement: "top",
    middleware: [offset(-4), hide()],
    whileElementsMounted: autoUpdate,
  });
  const isReferenceHidden = !!middlewareData.hide?.referenceHidden;

  useEffect(() => {
    refs.setReference(cellDom);
  }, [cellDom, refs]);

  // `cellDom` is inside the table, so `closest('.tableWrapper')` finds the
  // wrapper for this drag's auto-scroll. The handle itself lives in a
  // floating layer outside the editor DOM, so we can't walk up from it.
  const wrapper = cellDom?.closest<HTMLElement>(".tableWrapper") ?? null;

  const [menuOpened, setMenuOpened] = useState(false);
  const closeMenu = useCallback(() => setMenuOpened(false), []);
  useTableHandleDrag(editor, "col", handleEl, wrapper, closeMenu);

  const { onOpen, onClose } = useColumnRowMenuLifecycle({
    editor,
    orientation: "col",
    index,
    tableNode,
    tablePos,
  });

  if (!cellDom) return null;

  return (
    <Menu
      opened={menuOpened}
      onChange={setMenuOpened}
      position="bottom-start"
      onOpen={onOpen}
      onClose={onClose}
      withinPortal
      shadow="md"
    >
      <Menu.Target>
        <div
          ref={(node) => {
            refs.setFloating(node);
            setHandleEl(node);
          }}
          style={{
            ...floatingStyles,
            ...(isReferenceHidden ? { visibility: "hidden" as const } : {}),
          }}
          className={clsx(classes.handle, classes.columnHandle)}
          role="button"
          tabIndex={0}
          aria-label={t("Column actions")}
        >
          <span style={{ pointerEvents: "none", display: "inline-flex" }}>
            <GripIcon />
          </span>
        </div>
      </Menu.Target>
      <Menu.Dropdown>
        <ColumnHandleMenu
          editor={editor}
          index={index}
          tableNode={tableNode}
          tablePos={tablePos}
        />
      </Menu.Dropdown>
    </Menu>
  );
});

function GripIcon() {
  return (
    <svg viewBox="0 0 10 10" width="14" height="14" aria-hidden>
      <path
        fill="currentColor"
        d="M3,2 A1,1 0 1 1 3,0 A1,1 0 0 1 3,2 Z M3,6 A1,1 0 1 1 3,4 A1,1 0 0 1 3,6 Z M3,10 A1,1 0 1 1 3,8 A1,1 0 0 1 3,10 Z M7,2 A1,1 0 1 1 7,0 A1,1 0 0 1 7,2 Z M7,6 A1,1 0 1 1 7,4 A1,1 0 0 1 7,6 Z M7,10 A1,1 0 1 1 7,8 A1,1 0 0 1 7,10 Z"
      />
    </svg>
  );
}
