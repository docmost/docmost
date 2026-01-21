import {
  BubbleMenu as BaseBubbleMenu,
  posToDOMRect,
  findParentNode,
} from "@tiptap/react";
import { Node as PMNode } from "@tiptap/pm/model";
import React, { useCallback } from "react";
import { ActionIcon, Tooltip, Group } from "@mantine/core";
import {
  IconColumns,
  IconLayoutColumns,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Editor } from "@tiptap/core";

export interface ColumnMenuProps {
  editor: Editor;
}

export const ColumnMenu = React.memo(
  ({ editor }: ColumnMenuProps): JSX.Element => {
    const { t } = useTranslation();

    const shouldShow = useCallback(
      ({ state }: any) => {
        if (!state) {
          return false;
        }

        return editor.isActive("columnGroup");
      },
      [editor],
    );

    const getReferenceClientRect = useCallback(() => {
      const { selection } = editor.state;
      const parent = findParentNode(
        (node: PMNode) => node.type.name === "columnGroup",
      )(selection);

      if (parent) {
        const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
        if (dom) {
          return dom.getBoundingClientRect();
        }
      }

      return posToDOMRect(editor.view, selection.from, selection.to);
    }, [editor]);

    const setLayout = (widths: number[]) => {
      editor.chain().focus().updateColumnLayout(widths).run();
    };

    const deleteColumnGroup = () => {
      editor.chain().focus().deleteSelection().run();
    };

    return (
      <BaseBubbleMenu
        editor={editor}
        pluginKey="column-menu"
        updateDelay={0}
        tippyOptions={{
          getReferenceClientRect: getReferenceClientRect,
          offset: [0, 15],
          zIndex: 99,
        }}
        shouldShow={shouldShow}
      >
        <ActionIcon.Group>
          <Tooltip position="top" label={t("Equal Columns (50/50)")}>
            <ActionIcon
              onClick={() => setLayout([50, 50])}
              variant="default"
              size="lg"
            >
              <IconLayoutColumns size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Sidebar Left (25/75)")}>
            <ActionIcon
              onClick={() => setLayout([25, 75])}
              variant="default"
              size="lg"
            >
              <IconLayoutSidebarLeftCollapse size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Sidebar Right (75/25)")}>
            <ActionIcon
              onClick={() => setLayout([75, 25])}
              variant="default"
              size="lg"
            >
              <IconLayoutSidebarRightCollapse size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Delete Columns")}>
            <ActionIcon
              onClick={deleteColumnGroup}
              variant="default"
              size="lg"
              color="red"
            >
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        </ActionIcon.Group>
      </BaseBubbleMenu>
    );
  },
);

export default ColumnMenu;
