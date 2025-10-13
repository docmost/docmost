import { BubbleMenu as BaseBubbleMenu, posToDOMRect, findParentNode } from "@tiptap/react";
import React, { useCallback, useState, useEffect } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconArrowsMaximize, IconArrowsMinimize, IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { Editor } from "@tiptap/core";
import { useTranslation } from "react-i18next";
import { Node as PMNode } from "prosemirror-model";

interface EmbedMenuProps {
  editor: Editor;
}

export const EmbedMenu = React.memo(({ editor }: EmbedMenuProps): JSX.Element => {
  const { t } = useTranslation();
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    const updateHandler = () => {
      setForceUpdate(prev => prev + 1);
    };

    editor.on('transaction', updateHandler);
    return () => {
      editor.off('transaction', updateHandler);
    };
  }, [editor]);

  const shouldShow = useCallback(({ state }) => {
    if (!state) return false;
    return editor.isActive("embed");
  }, [editor]);

  const getReferenceClientRect = useCallback(() => {
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "embed";
    const parent = findParentNode(predicate)(selection);

    if (parent) {
      const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
      if (dom) {
        return dom.getBoundingClientRect();
      }
    }
    return posToDOMRect(editor.view, selection.from, selection.to);
  }, [editor]);

  const toggleResizable = useCallback(() => {
    const attrs = (editor.getAttributes("embed") as any) || {};
    const isResizable = attrs?.resizable ?? true;

    editor.chain().focus(undefined, { scrollIntoView: false }).updateAttributes('embed', { resizable: !isResizable }).run();
  }, [editor]);

  const toggleLazyLoad = useCallback(() => {
    const attrs = (editor.getAttributes("embed") as any) || {};
    const isLazyLoad = attrs?.lazyLoad ?? false;

    editor.chain().focus(undefined, { scrollIntoView: false }).updateAttributes('embed', { lazyLoad: !isLazyLoad }).run();
  }, [editor]);


  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="embed-menu"
      updateDelay={0}
      tippyOptions={{
        getReferenceClientRect,
        offset: [0, 10],
        placement: "top",
        zIndex: 99,
        popperOptions: {
          modifiers: [{ name: "flip", enabled: false }],
        },
      }}
      shouldShow={shouldShow}
    >
      <ActionIcon.Group>
        <Tooltip position="top" label={t("Toggle resizing")}>
          <ActionIcon
            onClick={toggleResizable}
            variant={
              editor.getAttributes("embed")?.resizable === true ? "light" : "default"
            }
            size="lg"
            aria-label={t("Toggle resizing")}
          >
            {editor.getAttributes("embed")?.resizable !== false ? (
              <IconArrowsMinimize size={18} />
            ) : (
              <IconArrowsMaximize size={18} />
            )}
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Toggle lazy loading")}>
          <ActionIcon
            onClick={toggleLazyLoad}
            variant={
              editor.getAttributes("embed")?.lazyLoad === true ? "light" : "default"
            }
            size="lg"
            aria-label={t("Toggle lazy loading")}
          >
            {editor.getAttributes("embed")?.lazyLoad === true ? (
              <IconPlayerPause size={18} />
            ) : (
              <IconPlayerPlay size={18} />
            )}
          </ActionIcon>
        </Tooltip>
      </ActionIcon.Group>
    </BaseBubbleMenu>
  );
});

export default EmbedMenu;
