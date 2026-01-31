import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import React, { useCallback, useState } from "react";
import { EditorMenuProps } from "@/features/editor/components/table/types/types.ts";
import { LinkEditorPanel } from "@/features/editor/components/link/link-editor-panel.tsx";
import { LinkPreviewPanel } from "@/features/editor/components/link/link-preview.tsx";
import { Card } from "@mantine/core";
import { useEditorState } from "@tiptap/react";

export function LinkMenu({ editor, appendTo }: EditorMenuProps) {
  const [showEdit, setShowEdit] = useState(false);

  const shouldShow = useCallback(() => {
    return editor.isActive("link");
  }, [editor]);

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return null;
      }
      const link = ctx.editor.getAttributes("link");
      return {
        href: link.href,
      };
    },
  });

  const handleEdit = useCallback(() => {
    setShowEdit(true);
  }, []);

  const onSetLink = useCallback(
    (url: string) => {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
      setShowEdit(false);
    },
    [editor],
  );

  const onUnsetLink = useCallback(() => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setShowEdit(false);
    return null;
  }, [editor]);

  const onShowEdit = useCallback(() => {
    setShowEdit(true);
  }, []);

  const onHideEdit = useCallback(() => {
    setShowEdit(false);
  }, []);

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey={`link-menu`}
      updateDelay={0}
      options={{
        onHide: () => {
          setShowEdit(false);
        },
        placement: "bottom",
        offset: 5,
        // zIndex: 101,
      }}
      shouldShow={shouldShow}
    >
      {showEdit ? (
        <Card
          withBorder
          radius="md"
          padding="xs"
          bg="var(--mantine-color-body)"
        >
          <LinkEditorPanel
            initialUrl={editorState?.href}
            onSetLink={onSetLink}
          />
        </Card>
      ) : (
        <LinkPreviewPanel
          url={editorState?.href}
          onClear={onUnsetLink}
          onEdit={handleEdit}
        />
      )}
    </BaseBubbleMenu>
  );
}

export default LinkMenu;
