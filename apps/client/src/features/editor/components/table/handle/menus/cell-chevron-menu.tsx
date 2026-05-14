import React from "react";
import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { ColorSwatch, Menu } from "@mantine/core";
import {
  IconBoxMargin,
  IconColumnInsertRight,
  IconColumnRemove,
  IconEraser,
  IconPalette,
  IconRowInsertBottom,
  IconRowRemove,
  IconSquareToggle,
  IconTableRow,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useTableClear } from "../hooks/use-table-clear";
import { TABLE_COLORS } from "../../table-background-color";
import { AlignmentSubmenu } from "./alignment-submenu";

interface CellChevronMenuProps {
  editor: Editor;
  cellPos: number;
  tableNode: ProseMirrorNode;
  tablePos: number;
}

export const CellChevronMenu = React.memo(function CellChevronMenu({
  editor,
  cellPos,
  tableNode,
  tablePos,
}: CellChevronMenuProps) {
  const { t } = useTranslation();

  const clearCell = useTableClear(editor, tableNode, tablePos, {
    kind: "cell",
    cellPos,
  });

  const setBackground = (color: string, name: string) => {
    editor
      .chain()
      .focus()
      .updateAttributes("tableCell", {
        backgroundColor: color || null,
        backgroundColorName: color ? name : null,
      })
      .updateAttributes("tableHeader", {
        backgroundColor: color || null,
        backgroundColorName: color ? name : null,
      })
      .run();
  };

  return (
    <>
      <Menu.Sub position="right-start">
        <Menu.Sub.Target>
          <Menu.Sub.Item leftSection={<IconPalette size={16} />}>
            {t("Background color")}
          </Menu.Sub.Item>
        </Menu.Sub.Target>
        <Menu.Sub.Dropdown>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
              padding: 8,
            }}
          >
            {TABLE_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setBackground(c.color, c.name)}
                aria-label={t(c.name)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <ColorSwatch
                  color={c.color || "#ffffff"}
                  size={22}
                  style={{
                    border: c.color === "" ? "1px solid #e5e7eb" : undefined,
                  }}
                />
              </button>
            ))}
          </div>
        </Menu.Sub.Dropdown>
      </Menu.Sub>

      <AlignmentSubmenu editor={editor} />

      <Menu.Item
        leftSection={<IconBoxMargin size={16} />}
        onClick={() => editor.chain().focus().mergeCells().run()}
        disabled={!editor.can().mergeCells()}
      >
        {t("Merge cells")}
      </Menu.Item>
      <Menu.Item
        leftSection={<IconSquareToggle size={16} />}
        onClick={() => editor.chain().focus().splitCell().run()}
        disabled={!editor.can().splitCell()}
      >
        {t("Split cell")}
      </Menu.Item>
      <Menu.Item
        leftSection={<IconTableRow size={16} />}
        onClick={() => editor.chain().focus().toggleHeaderCell().run()}
      >
        {t("Toggle header cell")}
      </Menu.Item>

      <Menu.Divider />

      <Menu.Item
        leftSection={<IconColumnInsertRight size={16} />}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      >
        {t("Add column right")}
      </Menu.Item>
      <Menu.Item
        leftSection={<IconRowInsertBottom size={16} />}
        onClick={() => editor.chain().focus().addRowAfter().run()}
      >
        {t("Add row below")}
      </Menu.Item>

      <Menu.Item leftSection={<IconEraser size={16} />} onClick={clearCell}>
        {t("Clear cell")}
      </Menu.Item>
      <Menu.Item
        leftSection={<IconColumnRemove size={16} />}
        onClick={() => editor.chain().focus().deleteColumn().run()}
      >
        {t("Delete column")}
      </Menu.Item>
      <Menu.Item
        leftSection={<IconRowRemove size={16} />}
        onClick={() => editor.chain().focus().deleteRow().run()}
      >
        {t("Delete row")}
      </Menu.Item>
    </>
  );
});
