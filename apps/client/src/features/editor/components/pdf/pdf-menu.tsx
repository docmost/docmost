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
  IconPaperclip,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "../common/toolbar-menu.module.css";

export function PdfMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return null;
      }

      const pdfAttrs = ctx.editor.getAttributes("pdf");

      return {
        isPdf: ctx.editor.isActive("pdf"),
        src: pdfAttrs?.src || null,
        name: pdfAttrs?.name || null,
        attachmentId: pdfAttrs?.attachmentId || null,
      };
    },
  });

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state || !editor.isActive("pdf")) {
        return false;
      }

      const { selection } = state;
      const dom = editor.view.nodeDOM(selection.from) as HTMLElement | null;
      if (!dom) return false;

      return !!dom.querySelector("[data-pdf-error]");
    },
    [editor],
  );

  const getReferencedVirtualElement = useCallback(() => {
    if (!editor) return;
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "pdf";
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

  const handleConvertToAttachment = useCallback(() => {
    if (!editorState?.src) return;

    const { selection } = editor.state;
    const { from } = selection;
    const node = editor.state.doc.nodeAt(from);
    if (!node || node.type.name !== "pdf") return;

    editor
      .chain()
      .insertContentAt(
        { from, to: from + node.nodeSize },
        {
          type: "attachment",
          attrs: {
            url: node.attrs.src,
            name: node.attrs.name,
            attachmentId: node.attrs.attachmentId,
            size: node.attrs.size,
            mime: "application/pdf",
          },
        },
      )
      .run();
  }, [editor, editorState]);

  const handleDelete = useCallback(() => {
    editor.commands.deleteSelection();
  }, [editor]);

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey={`pdf-menu`}
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
        <Tooltip position="top" label={t("Convert to attachment")} withinPortal={false}>
          <ActionIcon
            onClick={handleConvertToAttachment}
            size="lg"
            aria-label={t("Convert to attachment")}
            variant="subtle"
          >
            <IconPaperclip size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Delete")} withinPortal={false}>
          <ActionIcon
            onClick={handleDelete}
            size="lg"
            aria-label={t("Delete")}
            variant="subtle"
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Tooltip>
      </div>
    </BaseBubbleMenu>
  );
}

export default PdfMenu;
