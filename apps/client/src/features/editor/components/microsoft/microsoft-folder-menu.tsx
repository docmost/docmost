import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { findParentNode, posToDOMRect, useEditorState } from "@tiptap/react";
import { useCallback } from "react";
import { Node as PMNode } from "@tiptap/pm/model";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconExternalLink, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { isEditorReady, sanitizeMicrosoftFolderUrl } from "@docmost/editor-ext";
import { EditorMenuProps, ShouldShowProps } from "@/features/editor/components/table/types/types.ts";
import { microsoftApp } from "@/features/microsoft/utils/microsoft-app";
import classes from "../common/toolbar-menu.module.css";

export function MicrosoftFolderMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) return null;
      const attrs = ctx.editor.getAttributes("microsoftFolder");
      return { webUrl: sanitizeMicrosoftFolderUrl(attrs?.webUrl) };
    },
  });
  const webUrl = editorState?.webUrl ?? "";
  const app = microsoftApp(webUrl);

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state || !isEditorReady(editor)) return false;
      return editor.isActive("microsoftFolder");
    },
    [editor],
  );

  const getReferencedVirtualElement = useCallback(() => {
    if (!isEditorReady(editor)) return;
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "microsoftFolder";
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

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="microsoft-folder-menu"
      ref={(element) => {
        if (element) element.style.zIndex = "99";
      }}
      updateDelay={0}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={{ placement: "top", offset: 8, flip: false }}
      shouldShow={shouldShow}
    >
      <div className={classes.toolbar}>
        <Tooltip position="top" label={t("Open in {{app}}", { app })} withinPortal={false}>
          <ActionIcon
            component="a"
            href={webUrl || undefined}
            target="_blank"
            rel="noopener"
            size="lg"
            aria-label={t("Open in {{app}}", { app })}
            variant="subtle"
            disabled={!webUrl}
          >
            <IconExternalLink size={18} />
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

export default MicrosoftFolderMenu;
