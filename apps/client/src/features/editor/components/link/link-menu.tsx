import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react";
import React, { useCallback, useState } from "react";
import { EditorMenuProps } from "@/features/editor/components/table/types/types.ts";
import { LinkEditorPanel } from "@/features/editor/components/link/link-editor-panel.tsx";
import { LinkPreviewPanel } from "@/features/editor/components/link/link-preview.tsx";
import { Card } from "@mantine/core";

export function LinkMenu({ editor, appendTo }: EditorMenuProps) {
  const [showEdit, setShowEdit] = useState(false);

  const shouldShow = useCallback(() => {
    return editor.isActive("link");
  }, [editor]);

  const { href: link } = editor.getAttributes("link");

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
      pluginKey={`link-menu}`}
      updateDelay={0}
      tippyOptions={{
        appendTo: () => {
          return appendTo?.current;
        },
        onHidden: () => {
          setShowEdit(false);
        },
        placement: "bottom",
        offset: [0, 5],
        zIndex: 101,
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
          <LinkEditorPanel initialUrl={link} onSetLink={onSetLink} />
        </Card>
      ) : (
        <LinkPreviewPanel
          url={link}
          onClear={onUnsetLink}
          onEdit={handleEdit}
        />
      )}
    </BaseBubbleMenu>
  );
}

export default LinkMenu;
