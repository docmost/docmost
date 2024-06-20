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
} from "@tabler/icons-react";

export const TableCellMenu = React.memo(
  ({ editor, appendTo }: EditorMenuProps): JSX.Element => {
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
          <Tooltip position="top" label="Merge cells">
            <ActionIcon
              onClick={mergeCells}
              variant="default"
              size="lg"
              aria-label="Merge cells"
            >
              <IconBoxMargin size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label="Split cell">
            <ActionIcon
              onClick={splitCell}
              variant="default"
              size="lg"
              aria-label="Split cell"
            >
              <IconSquareToggle size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label="Delete column">
            <ActionIcon
              onClick={deleteColumn}
              variant="default"
              size="lg"
              aria-label="Delete column"
            >
              <IconColumnRemove size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label="Delete row">
            <ActionIcon
              onClick={deleteRow}
              variant="default"
              size="lg"
              aria-label="Delete row"
            >
              <IconRowRemove size={18} />
            </ActionIcon>
          </Tooltip>
        </ActionIcon.Group>
      </BaseBubbleMenu>
    );
  },
);

export default TableCellMenu;
