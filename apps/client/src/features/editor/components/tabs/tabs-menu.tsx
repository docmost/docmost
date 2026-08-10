import { BubbleMenu } from "@tiptap/react/menus";
import React, { useCallback } from "react";
import { EditorMenuProps, ShouldShowProps } from "../table/types/types";
import { isEditorReady, isTextSelected } from "@docmost/editor-ext";
import { Node as PMNode } from "@tiptap/pm/model";
import { findParentNode, posToDOMRect } from "@tiptap/core";
import classes from "../common/toolbar-menu.module.css";
import { ActionIcon, Tooltip } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  IconChevronLeft,
  IconChevronRight,
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconTrashX,
} from "@tabler/icons-react";

const TabsMenu = React.memo(({ editor }: EditorMenuProps) => {
  const { t } = useTranslation();

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) {
        return false;
      }

      if (isTextSelected(editor)) return false;

      return editor.isActive("tabs");
    },
    [editor]
  );

  const getReferencedVirtualElement = useCallback(() => {
    if (!isEditorReady(editor)) return;
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "tabs";
    const parent = findParentNode(predicate)(selection);

    if (parent) {
      const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
      const domRect = dom.getBoundingClientRect();
      return {
        getBoundingClientRect: () => domRect,
        getClientRects: () => [domRect],
      };
    }

    const domRect = posToDOMRect(editor.view, selection.from, selection.to);
    return {
      getBoundingClientRect: () => domRect,
      getClientRects: () => [domRect],
    };
  }, [editor]);

  const handleAddTabLeft = useCallback(() => {
    editor.chain().focus().insertTab("left").run();
  }, [editor]);

  const handleAddTabRight = useCallback(() => {
    editor.chain().focus().insertTab("right").run();
  }, [editor]);

  const handleMoveTabRight = useCallback(() => {
    editor.chain().focus().moveTab("right").run();
  }, [editor]);

  const handleMoveTabLeft = useCallback(() => {
    editor.chain().focus().moveTab("left").run();
  }, [editor]);

  const handleDeleteTab = useCallback(() => {
    editor.chain().focus().deleteTab().run();
  }, [editor]);

  const handleDelete = useCallback(() => {
    editor.chain().focus().deleteTabs().run();
  }, [editor]);

  return (
    <BubbleMenu
      style={{ zIndex: 99 }}
      editor={editor}
      pluginKey="tabs-menu"
      resizeDelay={0}
      getReferencedVirtualElement={getReferencedVirtualElement}
      shouldShow={shouldShow}
      options={{
        placement: "top",
        offset: false,
        flip: false,
      }}
    >
      <div className={classes.toolbar}>
        <Tooltip position="top" label={t("Add left tab")} withinPortal={false}>
          <ActionIcon
            onClick={handleAddTabLeft}
            variant="subtle"
            size="lg"
            aria-label={t("Add left tab")}
          >
            <IconColumnInsertLeft size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip position="top" label={t("Add right tab")} withinPortal={false}>
          <ActionIcon
            onClick={handleAddTabRight}
            variant="subtle"
            size="lg"
            aria-label={t("Add right tab")}
          >
            <IconColumnInsertRight size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip position="top" label={t("Delete tab")} withinPortal={false}>
          <ActionIcon
            onClick={handleDeleteTab}
            variant="subtle"
            size="lg"
            aria-label={t("Delete tab")}
          >
            <IconColumnRemove size={18} />
          </ActionIcon>
        </Tooltip>

        <div className={classes.divider} />

        <Tooltip position="top" label={t("Move tab left")} withinPortal={false}>
          <ActionIcon
            onClick={handleMoveTabLeft}
            variant="subtle"
            size="lg"
            aria-label={t("Move tab left")}
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Move tab right")} withinPortal={false}>
          <ActionIcon
            onClick={handleMoveTabRight}
            variant="subtle"
            size="lg"
            aria-label={t("Move tab right")}
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        </Tooltip>
        <div className={classes.divider} />

        <Tooltip position="top" label={t("Delete")} withinPortal={false}>
          <ActionIcon
            onClick={handleDelete}
            variant="subtle"
            size="lg"
            aria-label={t("Delete")}
          >
            <IconTrashX size={18} />
          </ActionIcon>
        </Tooltip>
      </div>
    </BubbleMenu>
  );
});

export default TabsMenu;
