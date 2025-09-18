import { BubbleMenu as BaseBubbleMenu, posToDOMRect, findParentNode } from "@tiptap/react";
import React, { useCallback } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconArrowsMaximize, IconArrowsMinimize } from "@tabler/icons-react";
import { Editor } from "@tiptap/core";
import { useTranslation } from "react-i18next";

interface EmbedMenuProps {
  editor: Editor;
}

export const EmbedMenu = React.memo(({ editor }: EmbedMenuProps): JSX.Element => {
  const { t } = useTranslation();

  const shouldShow = useCallback(({ state }) => {
    if (!state) return false;
    return editor.isActive("embed");
  }, [editor]);

  const toggleResizable = useCallback(() => {
    const attrs = (editor.getAttributes("embed") as any) || {};
    const isResizable = attrs?.resizable ?? true;

    editor.chain().focus(undefined, { scrollIntoView: false }).updateAttributes('embed', { resizable: !isResizable }).run();
  }, [editor]);

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="embed-menu"
      updateDelay={0}
      tippyOptions={{
        offset: [0, 10],
        zIndex: 99,
      }}
      shouldShow={shouldShow}
    >
      <ActionIcon.Group>
        <Tooltip position="top" label={t("Toggle resizing")}>
          <ActionIcon
            onClick={toggleResizable}
            variant="default"
            size="lg"
            aria-label={t("Toggle resizing")}
          >
            {(editor.getAttributes("embed") as any)?.resizable ? (
              <IconArrowsMinimize size={18} />
            ) : (
              <IconArrowsMaximize size={18} />
            )}
          </ActionIcon>
        </Tooltip>
      </ActionIcon.Group>
    </BaseBubbleMenu>
  );
});

export default EmbedMenu;
