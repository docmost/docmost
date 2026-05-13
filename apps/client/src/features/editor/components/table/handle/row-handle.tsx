import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { useFloating, offset, autoUpdate, hide } from "@floating-ui/react";
import { Menu } from "@mantine/core";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useTableHandleDrag } from "./hooks/use-table-handle-drag";
import { useColumnRowMenuLifecycle } from "./hooks/use-column-row-menu-lifecycle";
import { RowHandleMenu } from "./menus/row-handle-menu";
import classes from "./handle.module.css";

interface RowHandleProps {
  editor: Editor;
  index: number;
  anchorPos: number;
  tableNode: ProseMirrorNode;
  tablePos: number;
}

export const RowHandle = React.memo(function RowHandle({
  editor,
  index,
  anchorPos,
  tableNode,
  tablePos,
}: RowHandleProps) {
  const { t } = useTranslation();
  // See ColumnHandle for the rationale: keep the last valid cell DOM cached
  // so the handle div stays mounted across stale-anchor renders, otherwise
  // pragmatic-dnd silently aborts an in-flight drag.
  const lookupCellDom = editor.view.nodeDOM(anchorPos) as HTMLElement | null;
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
    placement: "left",
    middleware: [offset(-4), hide()],
    whileElementsMounted: autoUpdate,
  });
  const isReferenceHidden = !!middlewareData.hide?.referenceHidden;

  useEffect(() => {
    refs.setReference(cellDom);
  }, [cellDom, refs]);

  const wrapper = cellDom?.closest<HTMLElement>(".tableWrapper") ?? null;

  const [menuOpened, setMenuOpened] = useState(false);
  const closeMenu = useCallback(() => setMenuOpened(false), []);
  useTableHandleDrag(editor, "row", handleEl, wrapper, closeMenu);

  const { onOpen, onClose } = useColumnRowMenuLifecycle({
    editor,
    orientation: "row",
    index,
    tableNode,
    tablePos,
  });

  if (!cellDom) return null;

  return (
    <Menu
      opened={menuOpened}
      onChange={setMenuOpened}
      position="right-start"
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
          className={clsx(classes.handle, classes.rowHandle)}
          role="button"
          tabIndex={0}
          aria-label={t("Row actions")}
        >
          <span style={{ pointerEvents: "none", display: "inline-flex" }}>
            <GripIcon />
          </span>
        </div>
      </Menu.Target>
      <Menu.Dropdown>
        <RowHandleMenu
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
