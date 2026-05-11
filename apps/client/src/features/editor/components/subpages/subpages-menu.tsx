import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { posToDOMRect, findParentNode } from "@tiptap/react";
import { Node as PMNode } from "@tiptap/pm/model";
import React, { useCallback } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconSortAZ, IconSortZA, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Editor } from "@tiptap/core";
import { useSetAtom } from "jotai";
import { sortPages } from "@/features/page/services/page-service.ts";
import { queryClient } from "@/main.tsx";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { updateSortedChildren } from "@/features/page/tree/utils/utils.ts";

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
    const setTreeData = useSetAtom(treeDataAtom);

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

    const handleSort = useCallback(
      async (direction: 'asc' | 'desc') => {
        const pageId = editor.storage.pageId as string;
        if (!pageId) return;
        const sorted = await sortPages({ parentPageId: pageId, direction });
        const positionMap = new Map(sorted.map((p) => [p.id, p.position]));
        setTreeData((prev) =>
          updateSortedChildren(prev, pageId, direction, positionMap),
        );
        queryClient.invalidateQueries({
          queryKey: ["sidebar-pages", { pageId }],
        });
      },
      [editor, setTreeData],
    );

    return (
      <BaseBubbleMenu
        editor={editor}
        pluginKey={`subpages-menu`}
        updateDelay={0}
        shouldShow={shouldShow}
      >
        <Tooltip position="top" label={t("Sort A→Z")}>
          <ActionIcon
            onClick={() => handleSort('asc')}
            variant="default"
            size="lg"
            aria-label={t("Sort A→Z")}
          >
            <IconSortAZ size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Sort Z→A")}>
          <ActionIcon
            onClick={() => handleSort('desc')}
            variant="default"
            size="lg"
            aria-label={t("Sort Z→A")}
          >
            <IconSortZA size={18} />
          </ActionIcon>
        </Tooltip>

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
