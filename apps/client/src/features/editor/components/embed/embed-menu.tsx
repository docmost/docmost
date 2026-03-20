import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { findParentNode, posToDOMRect, useEditorState } from "@tiptap/react";
import { useCallback } from "react";
import { Node as PMNode } from "@tiptap/pm/model";
import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types.ts";
import { ActionIcon, Tooltip } from "@mantine/core";
import {
  IconLink,
  IconCopy,
  IconTrash,
  IconRefresh,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import classes from "../common/toolbar-menu.module.css";

export function EmbedMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return null;
      }

      const embedAttrs = ctx.editor.getAttributes("embed");

      return {
        isEmbed: ctx.editor.isActive("embed"),
        src: embedAttrs?.src || null,
        provider: embedAttrs?.provider || null,
      };
    },
  });

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) {
        return false;
      }

      return editor.isActive("embed") && editor.getAttributes("embed").src;
    },
    [editor],
  );

  const getReferencedVirtualElement = useCallback(() => {
    if (!editor) return;
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "embed";
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

  const handleConvertToLink = useCallback(() => {
    if (!editorState?.src) return;
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .deleteSelection()
      .command(({ commands }) => {
        return commands.insertContent({
          type: "paragraph",
          content: [
            {
              type: "text",
              text: editorState.src,
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: editorState.src,
                    target: "_blank",
                  },
                },
              ],
            },
          ],
        });
      })
      .run();
  }, [editor, editorState?.src]);

  const handleCopyUrl = useCallback(() => {
    if (!editorState?.src) return;
    navigator.clipboard.writeText(editorState.src).then(() => {
      notifications.show({
        message: t("Copied!"),
        color: "green",
      });
    });
  }, [editorState?.src, t]);

  const handleResetSize = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .updateAttributes("embed", { width: 640, height: 480 })
      .run();
  }, [editor]);

  const handleDelete = useCallback(() => {
    editor.commands.deleteSelection();
  }, [editor]);

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey={`embed-menu`}
      updateDelay={0}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={{
        placement: "top",
        offset: 8,
        flip: false,
      }}
      shouldShow={shouldShow}
    >
      <div className={classes.toolbar}>
        <Tooltip position="top" label={t("Convert to link")} withinPortal={false}>
          <ActionIcon
            onClick={handleConvertToLink}
            size="lg"
            aria-label={t("Convert to link")}
            variant="subtle"
          >
            <IconLink size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Copy URL")} withinPortal={false}>
          <ActionIcon
            onClick={handleCopyUrl}
            size="lg"
            aria-label={t("Copy URL")}
            variant="subtle"
          >
            <IconCopy size={18} />
          </ActionIcon>
        </Tooltip>
        
        <Tooltip position="top" label={t("Reset size")} withinPortal={false}>
          <ActionIcon
            onClick={handleResetSize}
            size="lg"
            aria-label={t("Reset size")}
            variant="subtle"
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>

        <div className={classes.divider} />

        <Tooltip position="top" label={t("Remove")} withinPortal={false}>
          <ActionIcon
            onClick={handleDelete}
            size="lg"
            aria-label={t("Remove")}
            variant="subtle"
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Tooltip>
      </div>
    </BaseBubbleMenu>
  );
}

export default EmbedMenu;
