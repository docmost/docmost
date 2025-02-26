import {
  BubbleMenu as BaseBubbleMenu,
  posToDOMRect,
  findParentNode,
} from "@tiptap/react";
import { Node as PMNode } from "@tiptap/pm/model";
import React, { useCallback } from "react";

import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types.ts";
import { ActionIcon, Tooltip } from "@mantine/core";
import {
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconRowRemove,
  IconTrashX,
} from "@tabler/icons-react";
import { isCellSelection } from "@docmost/editor-ext";
import { useTranslation } from "react-i18next";

export const TableMenu = React.memo(
  ({ editor }: EditorMenuProps): JSX.Element => {
    const { t } = useTranslation();
    const shouldShow = useCallback(
      ({ state }: ShouldShowProps) => {
        if (!state) {
          return false;
        }

        return editor.isActive("table") && !isCellSelection(state.selection);
      },
      [editor],
    );

    const getReferenceClientRect = useCallback(() => {
      const { selection } = editor.state;
      const predicate = (node: PMNode) => node.type.name === "table";
      const parent = findParentNode(predicate)(selection);

      if (parent) {
        const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
        return dom.getBoundingClientRect();
      }

      return posToDOMRect(editor.view, selection.from, selection.to);
    }, [editor]);

    const addColumnLeft = useCallback(() => {
      editor.chain().focus().addColumnBefore().run();
    }, [editor]);

    const addColumnRight = useCallback(() => {
      editor.chain().focus().addColumnAfter().run();
    }, [editor]);

    const deleteColumn = useCallback(() => {
      editor.chain().focus().deleteColumn().run();
    }, [editor]);

    const addRowAbove = useCallback(() => {
      editor.chain().focus().addRowBefore().run();
    }, [editor]);

    const addRowBelow = useCallback(() => {
      editor.chain().focus().addRowAfter().run();
    }, [editor]);

    const deleteRow = useCallback(() => {
      editor.chain().focus().deleteRow().run();
    }, [editor]);

    const deleteTable = useCallback(() => {
      editor.chain().focus().deleteTable().run();
    }, [editor]);

    return (
      <BaseBubbleMenu
        editor={editor}
        pluginKey="table-menu"
        updateDelay={0}
        tippyOptions={{
          getReferenceClientRect: getReferenceClientRect,
          offset: [0, 15],
          zIndex: 99,
          popperOptions: {
            modifiers: [
              {
                name: "preventOverflow",
                enabled: true,
                options: {
                  altAxis: true,
                  boundary: "clippingParents",
                  padding: 8,
                },
              },
              {
                name: "flip",
                enabled: true,
                options: {
                  boundary: editor.options.element,
                  fallbackPlacements: ["top", "bottom"],
                  padding: { top: 35, left: 8, right: 8, bottom: -Infinity },
                },
              },
            ],
          },
        }}
        shouldShow={shouldShow}
      >
        <ActionIcon.Group>
          <Tooltip position="top" label={t("Add left column")}
          >
            <ActionIcon
              onClick={addColumnLeft}
              variant="default"
              size="lg"
              aria-label={t("Add left column")}
            >
              <IconColumnInsertLeft size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Add right column")}>
            <ActionIcon
              onClick={addColumnRight}
              variant="default"
              size="lg"
              aria-label={t("Add right column")}
            >
              <IconColumnInsertRight size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Delete column")}>
            <ActionIcon
              onClick={deleteColumn}
              variant="default"
              size="lg"
              aria-label={t("Delete column")}
            >
              <IconColumnRemove size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Add row above")}>
            <ActionIcon
              onClick={addRowAbove}
              variant="default"
              size="lg"
              aria-label={t("Add row above")}
            >
              <IconRowInsertTop size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Add row below")}>
            <ActionIcon
              onClick={addRowBelow}
              variant="default"
              size="lg"
              aria-label={t("Add row below")}
            >
              <IconRowInsertBottom size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Delete row")}>
            <ActionIcon
              onClick={deleteRow}
              variant="default"
              size="lg"
              aria-label={t("Delete row")}
            >
              <IconRowRemove size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Delete table")}>
            <ActionIcon
              onClick={deleteTable}
              variant="default"
              size="lg"
              color="red"
              aria-label={t("Delete table")}
            >
              <IconTrashX size={18} />
            </ActionIcon>
          </Tooltip>
        </ActionIcon.Group>
      </BaseBubbleMenu>
    );
  },
);

export default TableMenu;
