import {
  BubbleMenu as BaseBubbleMenu,
  findParentNode,
  posToDOMRect,
  useEditorState,
} from "@tiptap/react";
import React, { useCallback, useEffect, useState } from "react";
import { sticky } from "tippy.js";
import { Node as PMNode } from "prosemirror-model";
import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types.ts";
import { ActionIcon, Tooltip, Popover, Textarea, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconFileDescription,
  IconLayoutAlignCenter,
  IconLayoutAlignLeft,
  IconLayoutAlignRight,
} from "@tabler/icons-react";
import { NodeWidthResize } from "@/features/editor/components/common/node-width-resize.tsx";
import { useTranslation } from "react-i18next";

const MAX_IMAGE_DESC_LENGTH = 2500;

export function ImageMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();
  const [isImageDescOpen, setIsImageDescOpen] = useState(false);
  const [imageDesc, setImageDesc] = useState("");

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) {
        return false;
      }
      return editor.isActive("image");
    },
    [editor],
  );

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return null;
      }
      const imageAttrs = ctx.editor.getAttributes("image");
      return {
        isImage: ctx.editor.isActive("image"),
        isAlignLeft: ctx.editor.isActive("image", { align: "left" }),
        isAlignCenter: ctx.editor.isActive("image", { align: "center" }),
        isAlignRight: ctx.editor.isActive("image", { align: "right" }),
        width: imageAttrs?.width ? parseInt(imageAttrs.width) : null,
        alt: imageAttrs?.alt || "",
      };
    },
  });

  useEffect(() => {
    if (editorState?.alt !== undefined) {
      setImageDesc(editorState.alt);
    }
  }, [editorState?.alt, isImageDescOpen]);

  const getReferenceClientRect = useCallback(() => {
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "image";
    const parent = findParentNode(predicate)(selection);
    if (parent) {
      const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
      return dom.getBoundingClientRect();
    }
    return posToDOMRect(editor.view, selection.from, selection.to);
  }, [editor]);

  const alignImageLeft = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setImageAlign("left")
      .run();
  }, [editor]);

  const alignImageCenter = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setImageAlign("center")
      .run();
  }, [editor]);

  const alignImageRight = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setImageAlign("right")
      .run();
  }, [editor]);

  const onWidthChange = useCallback(
    (value: number) => {
      editor
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .setImageWidth(value)
        .run();
    },
    [editor],
  );

  const updateImageDescription = useCallback(() => {
    if (imageDesc === editorState?.alt) return;

    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .updateAttributes("image", { alt: imageDesc })
      .run();
  }, [editor, imageDesc, editorState?.alt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      updateImageDescription();
      setIsImageDescOpen(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.currentTarget.value;
    setImageDesc(val);

    if (val.length >= MAX_IMAGE_DESC_LENGTH) {
      notifications.show({
        id: "image-desc-limit",
        color: "red",
        title: t("Limit reached"),
        message: t("Image description cannot exceed {{limit}} characters", { limit: MAX_IMAGE_DESC_LENGTH }),
        autoClose: 3000,
      });
    }
  };

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="image-menu"
      updateDelay={0}
      tippyOptions={{
        getReferenceClientRect,
        offset: [0, 8],
        zIndex: 99,
        popperOptions: {
          modifiers: [{ name: "flip", enabled: false }],
        },
        plugins: [sticky],
        sticky: "popper",
      }}
      shouldShow={shouldShow}
    >
      <ActionIcon.Group className="actionIconGroup">
        <Tooltip position="top" label={t("Align left")}>
          <ActionIcon
            onClick={alignImageLeft}
            size="lg"
            aria-label={t("Align left")}
            variant={editorState?.isAlignLeft ? "light" : "default"}
          >
            <IconLayoutAlignLeft size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip position="top" label={t("Align center")}>
          <ActionIcon
            onClick={alignImageCenter}
            size="lg"
            aria-label={t("Align center")}
            variant={editorState?.isAlignCenter ? "light" : "default"}
          >
            <IconLayoutAlignCenter size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip position="top" label={t("Align right")}>
          <ActionIcon
            onClick={alignImageRight}
            size="lg"
            aria-label={t("Align right")}
            variant={editorState?.isAlignRight ? "light" : "default"}
          >
            <IconLayoutAlignRight size={18} />
          </ActionIcon>
        </Tooltip>

        <Popover
          opened={isImageDescOpen}
          onChange={setIsImageDescOpen}
          trapFocus
          position="bottom"
          withArrow
          shadow="md"
        >
          <Popover.Target>
            <Tooltip position="top" label={t("Image description")}>
              <ActionIcon
                onClick={() => setIsImageDescOpen((o) => !o)}
                size="lg"
                aria-label={t("Image description")}
                variant={isImageDescOpen || editorState?.alt ? "light" : "default"}
              >
                <IconFileDescription size={18} />
              </ActionIcon>
            </Tooltip>
          </Popover.Target>
          <Popover.Dropdown p="xs" onPointerDown={(e) => e.stopPropagation()}>
            <Textarea
              placeholder={t("Image description")}
              value={imageDesc}
              onChange={handleChange}
              onBlur={updateImageDescription}
              onKeyDown={handleKeyDown}
              size="xs"
              data-autofocus
              autosize
              minRows={1}
              maxRows={10}
              w={250}
              maxLength={MAX_IMAGE_DESC_LENGTH}
              styles={{
                input: {
                  resize: "none",
                  overflow: "auto",
                },
              }}
            />
            <Text
              size="xs"
              c={imageDesc.length >= MAX_IMAGE_DESC_LENGTH ? "red" : "dimmed"}
              ta="right"
              mt={4}
              style={{ fontSize: "10px" }}
            >
              {imageDesc.length} / {MAX_IMAGE_DESC_LENGTH}
            </Text>
          </Popover.Dropdown>
        </Popover>

      </ActionIcon.Group>
      {editorState?.width && (
        <NodeWidthResize onChange={onWidthChange} value={editorState.width} />
      )}
    </BaseBubbleMenu>
  );
}

export default ImageMenu;
