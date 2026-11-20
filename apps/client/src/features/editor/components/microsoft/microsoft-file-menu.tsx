import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { findParentNode, posToDOMRect, useEditorState } from "@tiptap/react";
import { useCallback } from "react";
import { Node as PMNode } from "@tiptap/pm/model";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconAt, IconMaximize, IconTrash } from "@tabler/icons-react";
import { useAtomValue, useSetAtom, type PrimitiveAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { isEditorReady, sanitizeMicrosoftFileItems, type MicrosoftFileItem } from "@docmost/editor-ext";
import { EditorMenuProps, ShouldShowProps } from "@/features/editor/components/table/types/types.ts";
import {
  microsoftFullscreenAtom,
  microsoftFullscreenHostsAtom,
} from "@/features/microsoft/atoms/microsoft-atoms";
import { replaceMicrosoftFileWithMentions } from "@/features/microsoft/utils/microsoft-mentions";
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

  const convertToMentions = () => {
    const { from } = editor.state.selection;
    if (replaceMicrosoftFileWithMentions(editor, from, editorState?.items ?? [])) {
      editor.commands.focus(undefined, { scrollIntoView: false });
    }
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
        <Tooltip position="top" label={t("Mention")} withinPortal={false}>
          <ActionIcon
            onClick={convertToMentions}
            size="lg"
            aria-label={t("Mention")}
            variant="subtle"
            disabled={!editorState?.items.length}
          >
            <IconAt size={18} />
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
