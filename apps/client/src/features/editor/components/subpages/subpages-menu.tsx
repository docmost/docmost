import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { posToDOMRect, findParentNode, useEditorState } from "@tiptap/react";
import { Node as PMNode } from "@tiptap/pm/model";
import React, { useCallback, type JSX } from "react";
import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { IconArrowsSort, IconCheck, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Editor } from "@tiptap/core";
import { isEditorReady } from "@docmost/editor-ext";
import type { SubpagesSortBy } from "./subpages.utils";

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
      if (!isEditorReady(editor)) return new DOMRect();
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

    const editorState = useEditorState({
      editor,
      selector: (ctx) => {
        if (!ctx.editor) return { sortBy: "default" };
        return {
          sortBy: (ctx.editor.getAttributes("subpages").sortBy ||
            "default"),
        };
      },
    });

    const sortBy = editorState?.sortBy || "default";

    const updateSort = useCallback(
      (value: SubpagesSortBy) => {
        editor
          .chain()
          .focus(undefined, { scrollIntoView: false })
          .setSubpagesSortBy(value)
          .run();
      },
      [editor],
    );

    return (
      <BaseBubbleMenu
        editor={editor}
        pluginKey={`subpages-menu`}
        ref={(element) => {
          if (element) element.style.zIndex = "99";
        }}
        updateDelay={0}
        shouldShow={shouldShow}
      >
        <Menu shadow="md" position="top-start" withinPortal>
          <Menu.Target>
            <Tooltip position="top" label={t("Sort")}>
              <ActionIcon
                variant="default"
                size="lg"
                aria-label={t("Sort")}
              >
                <IconArrowsSort size={18} />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{t("Sort by")}</Menu.Label>
            <Menu.Item
              leftSection={sortBy === "default" ? <IconCheck size={14} /> : null}
              onClick={() => updateSort("default")}
            >
              {t("Default")}
            </Menu.Item>
            <Menu.Item
              leftSection={sortBy === "title-asc" ? <IconCheck size={14} /> : null}
              onClick={() => updateSort("title-asc")}
            >
              {t("Sort A → Z")}
            </Menu.Item>
            <Menu.Item
              leftSection={sortBy === "title-desc" ? <IconCheck size={14} /> : null}
              onClick={() => updateSort("title-desc")}
            >
              {t("Sort Z → A")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
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
