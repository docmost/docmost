import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { findParentNode, posToDOMRect, useEditorState } from "@tiptap/react";
import { useCallback } from "react";
import { Node as PMNode } from "@tiptap/pm/model";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconLink, IconMaximize, IconPhoto, IconTrash } from "@tabler/icons-react";
import { useAtomValue, useSetAtom, type PrimitiveAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { isEditorReady, sanitizeMicrosoftFileItems, type MicrosoftFileItem } from "@docmost/editor-ext";
import { EditorMenuProps, ShouldShowProps } from "@/features/editor/components/table/types/types.ts";
import {
  microsoftFullscreenAtom,
  microsoftFullscreenHostsAtom,
} from "@/features/microsoft/atoms/microsoft-atoms";
import classes from "../common/toolbar-menu.module.css";

export function MicrosoftFileMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();
  const setFullscreen = useSetAtom(microsoftFullscreenAtom as PrimitiveAtom<MicrosoftFileItem | null>);
  const hosts = useAtomValue(microsoftFullscreenHostsAtom);

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) return null;
      const attrs = ctx.editor.getAttributes("microsoftFile");
      return {
        isActive: ctx.editor.isActive("microsoftFile"),
        display: attrs?.display === "link" ? "link" : "embed",
        items: sanitizeMicrosoftFileItems(attrs?.items),
      };
    },
  });

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state || !isEditorReady(editor)) return false;
      return editor.isActive("microsoftFile");
    },
    [editor],
  );

  const getReferencedVirtualElement = useCallback(() => {
    if (!isEditorReady(editor)) return;
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "microsoftFile";
    const parent = findParentNode(predicate)(selection);
    if (parent) {
      const dom = editor.view.nodeDOM(parent.pos) as HTMLElement | null;
      if (dom) {
        const domRect = dom.getBoundingClientRect();
        return { getBoundingClientRect: () => domRect, getClientRects: () => [domRect] };
      }
    }
    const domRect = posToDOMRect(editor.view, selection.from, selection.to);
    return { getBoundingClientRect: () => domRect, getClientRects: () => [domRect] };
  }, [editor]);

  const setDisplay = (display: "embed" | "link") => {
    editor.chain().focus(undefined, { scrollIntoView: false }).updateAttributes("microsoftFile", { display }).run();
  };

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="microsoft-file-menu"
      ref={(element) => {
        if (element) element.style.zIndex = "99";
      }}
      updateDelay={0}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={{ placement: "top", offset: 8, flip: false }}
      shouldShow={shouldShow}
    >
      <div className={classes.toolbar}>
        <Tooltip position="top" label={t("Embed view")} withinPortal={false}>
          <ActionIcon
            onClick={() => setDisplay("embed")}
            size="lg"
            aria-label={t("Embed view")}
            variant={editorState?.display === "embed" ? "light" : "subtle"}
          >
            <IconPhoto size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip position="top" label={t("Link view")} withinPortal={false}>
          <ActionIcon
            onClick={() => setDisplay("link")}
            size="lg"
            aria-label={t("Link view")}
            variant={editorState?.display === "link" ? "light" : "subtle"}
          >
            <IconLink size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip position="top" label={t("Full screen")} withinPortal={false}>
          <ActionIcon
            onClick={() => editorState?.items[0] && setFullscreen(editorState.items[0])}
            size="lg"
            aria-label={t("Full screen")}
            variant="subtle"
            disabled={!editorState?.items.length || hosts === 0}
          >
            <IconMaximize size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip position="top" label={t("Delete")} withinPortal={false}>
          <ActionIcon onClick={() => editor.commands.deleteSelection()} size="lg" aria-label={t("Delete")} variant="subtle">
            <IconTrash size={18} />
          </ActionIcon>
        </Tooltip>
      </div>
    </BaseBubbleMenu>
  );
}

export default MicrosoftFileMenu;
