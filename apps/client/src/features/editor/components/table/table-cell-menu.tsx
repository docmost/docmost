import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react";
import React, { useCallback } from "react";

import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types.ts";
import { isCellSelection } from "@docmost/editor-ext";
import { ActionIcon, Tooltip } from "@mantine/core";
import {
  IconBoxMargin,
  IconColumnRemove,
  IconRowRemove,
  IconSquareToggle,
  IconTableRow,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { TableBackgroundColor } from "./table-background-color";
import { TableTextAlignment } from "./table-text-alignment";

export const TableCellMenu = React.memo(
  ({ editor, appendTo }: EditorMenuProps): JSX.Element => {
    const { t } = useTranslation();
    const shouldShow = useCallback(
      ({ view, state, from }: ShouldShowProps) => {
        if (!state) {
          return false;
        }

        return isCellSelection(state.selection);
      },
      [editor],
    );

    const mergeCells = useCallback(() => {
      editor.chain().focus().mergeCells().run();
    }, [editor]);

    const splitCell = useCallback(() => {
      editor.chain().focus().splitCell().run();
    }, [editor]);

    const deleteColumn = useCallback(() => {
      editor.chain().focus().deleteColumn().run();
    }, [editor]);

    const deleteRow = useCallback(() => {
      editor.chain().focus().deleteRow().run();
    }, [editor]);

    const toggleHeaderCell = useCallback(() => {
      editor.chain().focus().toggleHeaderCell().run();
    }, [editor]);

    return (
      <BaseBubbleMenu
        editor={editor}
        pluginKey="table-cell-menu"
        updateDelay={0}
        tippyOptions={{
          appendTo: () => {
            return appendTo?.current;
          },
          offset: [0, 15],
          zIndex: 99,
        }}
        shouldShow={shouldShow}
      >
        <ActionIcon.Group>
          <TableBackgroundColor editor={editor} />
          <TableTextAlignment editor={editor} />
          
          <Tooltip position="top" label={t("Merge cells")}>
            <ActionIcon
              onClick={mergeCells}
              variant="default"
              size="lg"
              aria-label={t("Merge cells")}
            >
              <IconBoxMargin size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Split cell")}>
            <ActionIcon
              onClick={splitCell}
              variant="default"
              size="lg"
              aria-label={t("Split cell")}
            >
              <IconSquareToggle size={18} />
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

          <Tooltip position="top" label={t("Toggle header cell")}>
            <ActionIcon
              onClick={toggleHeaderCell}
              variant="default"
              size="lg"
              aria-label={t("Toggle header cell")}
            >
              <IconTableRow size={18} />
            </ActionIcon>
          </Tooltip>
        </ActionIcon.Group>
      </BaseBubbleMenu>
    );
  },
);

export default TableCellMenu;
