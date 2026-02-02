import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { posToDOMRect, findParentNode } from "@tiptap/react";
import { Node as PMNode } from "@tiptap/pm/model";
import React, { useCallback } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Editor } from "@tiptap/core";

interface SubpagesMenuProps {
  editor: Editor;
}

interface ShouldShowProps {
  state: any;
  from?: number;
  to?: number;
}

export const SubpagesMenu = React.memo(
  ({ editor }: SubpagesMenuProps): JSX.Element => {
    const { t } = useTranslation();

    const shouldShow = useCallback(
      ({ state }: ShouldShowProps) => {
        if (!state) {
          return false;
        }

        return editor.isActive("subpages");
      },
      [editor]
    );

    const getReferenceClientRect = useCallback(() => {
      const { selection } = editor.state;
      const predicate = (node: PMNode) => node.type.name === "subpages";
      const parent = findParentNode(predicate)(selection);

      if (parent) {
        const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
        return dom.getBoundingClientRect();
      }

      return posToDOMRect(editor.view, selection.from, selection.to);
    }, [editor]);

    const deleteNode = useCallback(() => {
      const { selection } = editor.state;
      editor
        .chain()
        .focus()
        .setNodeSelection(selection.from)
        .deleteSelection()
        .run();
    }, [editor]);

    return (
      <BaseBubbleMenu
        editor={editor}
        pluginKey={`subpages-menu`}
        updateDelay={0}
        shouldShow={shouldShow}
      >
        <Tooltip position="top" label={t("Delete")}>
          <ActionIcon
            onClick={deleteNode}
            variant="default"
            size="lg"
            color="red"
            aria-label={t("Delete")}
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Tooltip>
      </BaseBubbleMenu>
    );
  }
);

export default SubpagesMenu;
