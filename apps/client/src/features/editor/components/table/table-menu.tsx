import { posToDOMRect, findParentNode } from "@tiptap/react";
import { Node as PMNode } from "@tiptap/pm/model";
import React, { useCallback } from "react";
import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types.ts";
import { ActionIcon, Menu, Tooltip } from "@mantine/core";
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
import { isCellSelection, isTextSelected } from "@docmost/editor-ext";
import { useTranslation } from "react-i18next";
import classes from "../common/toolbar-menu.module.css";
import { insertTableFormula, TableFormulaType } from "./table-formula-utils";

const FORMULAS: {
  type: TableFormulaType;
  label: string;
  description: string;
}[] = [
  { type: "sum", label: "SUM", description: "Sum of numbers in this column" },
  {
    type: "average",
    label: "AVERAGE",
    description: "Average of numbers in this column",
  },
  {
    type: "count",
    label: "COUNT",
    description: "Count of numbers in this column",
  },
  {
    type: "min",
    label: "MIN",
    description: "Minimum value in this column",
  },
  {
    type: "max",
    label: "MAX",
    description: "Maximum value in this column",
  },
];

export const TableMenu = React.memo(
  ({ editor }: EditorMenuProps): JSX.Element => {
    const { t } = useTranslation();
    const shouldShow = useCallback(
      ({ state }: ShouldShowProps) => {
        if (!state) {
          return false;
        }

        if (isTextSelected(editor)) return false;
        return editor.isActive("table") && !isCellSelection(state.selection);
      },
      [editor],
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

    const applyFormula = useCallback(
      (type: TableFormulaType) => {
        insertTableFormula(editor, type);
      },
      [editor],
    );

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
        <div className={classes.toolbar}>
          <Tooltip
            position="top"
            label={t("Add left column")}
            withinPortal={false}
          >
            <ActionIcon
              onClick={addColumnLeft}
              variant="subtle"
              size="lg"
              aria-label={t("Add left column")}
            >
              <IconColumnInsertLeft size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip
            position="top"
            label={t("Add right column")}
            withinPortal={false}
          >
            <ActionIcon
              onClick={addColumnRight}
              variant="subtle"
              size="lg"
              aria-label={t("Add right column")}
            >
              <IconColumnInsertRight size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip
            position="top"
            label={t("Delete column")}
            withinPortal={false}
          >
            <ActionIcon
              onClick={deleteColumn}
              variant="subtle"
              size="lg"
              aria-label={t("Delete column")}
            >
              <IconColumnRemove size={18} />
            </ActionIcon>
          </Tooltip>

          <div className={classes.divider} />

          <Tooltip
            position="top"
            label={t("Add row above")}
            withinPortal={false}
          >
            <ActionIcon
              onClick={addRowAbove}
              variant="subtle"
              size="lg"
              aria-label={t("Add row above")}
            >
              <IconRowInsertTop size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip
            position="top"
            label={t("Add row below")}
            withinPortal={false}
          >
            <ActionIcon
              onClick={addRowBelow}
              variant="subtle"
              size="lg"
              aria-label={t("Add row below")}
            >
              <IconRowInsertBottom size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Delete row")} withinPortal={false}>
            <ActionIcon
              onClick={deleteRow}
              variant="subtle"
              size="lg"
              aria-label={t("Delete row")}
            >
              <IconRowRemove size={18} />
            </ActionIcon>
          </Tooltip>

          <div className={classes.divider} />

          <Tooltip
            position="top"
            label={t("Toggle header row")}
            withinPortal={false}
          >
            <ActionIcon
              onClick={toggleHeaderRow}
              variant="subtle"
              size="lg"
              aria-label={t("Toggle header row")}
            >
              <IconTableRow size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip
            position="top"
            label={t("Toggle header column")}
            withinPortal={false}
          >
            <ActionIcon
              onClick={toggleHeaderColumn}
              variant="subtle"
              size="lg"
              aria-label={t("Toggle header column")}
            >
              <IconTableColumn size={18} />
            </ActionIcon>
          </Tooltip>

          <div className={classes.divider} />

          {/* ── Column formula dropdown ── */}
          <Menu shadow="md" width={220} position="top" withinPortal={false}>
            <Menu.Target>
              <Tooltip position="top" label={t("Column formula")}>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  aria-label={t("Column formula")}
                >
                  <IconTableColumn size={18} />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>{t("Insert result into current cell")}</Menu.Label>
              {FORMULAS.map(({ type, label, description }) => (
                <Menu.Item
                  key={type}
                  onClick={() => applyFormula(type)}
                  leftSection={
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        width: 52,
                        color: "blue",
                      }}
                    >
                      {label}
                    </span>
                  }
                >
                  <span style={{ fontSize: "0.75rem", color: "dimgray" }}>
                    {t(description)}
                  </span>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>

          <div className={classes.divider} />

          <Tooltip position="top" label={t("Delete table")}>
            <ActionIcon
              onClick={deleteTable}
              variant="subtle"
              size="lg"
              aria-label={t("Delete table")}
            >
              <IconTrashX size={18} />
            </ActionIcon>
          </Tooltip>
        </div>
      </BubbleMenu>
    );
  },
);

export default TableMenu;
