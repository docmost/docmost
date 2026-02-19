import { posToDOMRect, findParentNode } from "@tiptap/react";
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
  IconTableColumn,
  IconTableRow,
  IconTrashX,
} from "@tabler/icons-react";
import { BubbleMenu } from "@tiptap/react/menus";
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
      [editor]
    );

    const getReferencedVirtualElement = useCallback(() => {
      const { selection } = editor.state;
      const predicate = (node: PMNode) => node.type.name === "table";
      const parent = findParentNode(predicate)(selection);

      if (parent) {
        const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
        const rect = dom.getBoundingClientRect();
        return {
          getBoundingClientRect: () => rect,
          getClientRects: () => [rect],
        };
      }

      const rect = posToDOMRect(editor.view, selection.from, selection.to);
      return {
        getBoundingClientRect: () => rect,
        getClientRects: () => [rect],
      };
    }, [editor]);

    const toggleHeaderColumn = useCallback(() => {
      editor.chain().focus().toggleHeaderColumn().run();
    }, [editor]);

    const toggleHeaderRow = useCallback(() => {
      editor.chain().focus().toggleHeaderRow().run();
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
      <BubbleMenu
        editor={editor}
        pluginKey="table-menu"
        resizeDelay={0}
        getReferencedVirtualElement={getReferencedVirtualElement}
        ref={(element) => {
          element.style.zIndex = "99";
        }}
        options={{
          placement: "top",
          offset: {
            mainAxis: 15,
          },
          flip: {
            fallbackPlacements: ["top", "bottom"],
            padding: { top: 35 + 15, left: 8, right: 8, bottom: -Infinity },
            boundary: editor.options.element as HTMLElement,
          },
          shift: {
            padding: 8 + 15,
            crossAxis: true,
          },
        }}
        shouldShow={shouldShow}
      >
        <ActionIcon.Group>
          <Tooltip position="top" label={t("Add left column")}>
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

          <Tooltip position="top" label={t("Toggle header row")}>
            <ActionIcon
              onClick={toggleHeaderRow}
              variant="default"
              size="lg"
              aria-label={t("Toggle header row")}
            >
              <IconTableRow size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Toggle header column")}>
            <ActionIcon
              onClick={toggleHeaderColumn}
              variant="default"
              size="lg"
              aria-label={t("Toggle header column")}
            >
              <IconTableColumn size={18} />
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
      </BubbleMenu>
    );
  }
);

export default TableMenu;
