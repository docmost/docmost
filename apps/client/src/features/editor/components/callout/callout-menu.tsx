import {
  BubbleMenu as BaseBubbleMenu,
  findParentNode,
  posToDOMRect,
} from "@tiptap/react";
import React, { useCallback } from "react";
import { Node as PMNode } from "prosemirror-model";
import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types.ts";
import { ActionIcon, Tooltip, Divider } from "@mantine/core";
import {
  IconAlertTriangleFilled,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconInfoCircleFilled,
  IconMoodSmile,
} from "@tabler/icons-react";
import { CalloutType } from "@docmost/editor-ext";
import { useTranslation } from "react-i18next";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";

export function CalloutMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) {
        return false;
      }

      return editor.isActive("callout");
    },
    [editor],
  );

  const getReferenceClientRect = useCallback(() => {
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "callout";
    const parent = findParentNode(predicate)(selection);

    if (parent) {
      const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
      return dom.getBoundingClientRect();
    }

    return posToDOMRect(editor.view, selection.from, selection.to);
  }, [editor]);

  const setCalloutType = useCallback(
    (calloutType: CalloutType) => {
      editor
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .updateCalloutType(calloutType)
        .run();
    },
    [editor],
  );

  const setCalloutIcon = useCallback(
    (emoji: any) => {
      const emojiChar = emoji?.native || emoji?.emoji || emoji;
      editor
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .updateCalloutIcon(emojiChar)
        .run();
    },
    [editor],
  );

  const removeCalloutIcon = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .updateCalloutIcon("")
      .run();
  }, [editor]);

  const getCurrentIcon = () => {
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "callout";
    const parent = findParentNode(predicate)(selection);
    const icon = parent?.node.attrs.icon;
    return icon || null;
  };

  const currentIcon = getCurrentIcon();

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey={`callout-menu}`}
      updateDelay={0}
      tippyOptions={{
        getReferenceClientRect,
        offset: [0, 10],
        placement: "bottom",
        zIndex: 99,
        popperOptions: {
          modifiers: [{ name: "flip", enabled: false }],
        },
      }}
      shouldShow={shouldShow}
    >
      <ActionIcon.Group className="actionIconGroup">
        <Tooltip position="top" label={t("Info")}>
          <ActionIcon
            onClick={() => setCalloutType("info")}
            size="lg"
            aria-label={t("Info")}
            variant={
              editor.isActive("callout", { type: "info" }) ? "light" : "default"
            }
          >
            <IconInfoCircleFilled size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Success")}>
          <ActionIcon
            onClick={() => setCalloutType("success")}
            size="lg"
            aria-label={t("Success")}
            variant={
              editor.isActive("callout", { type: "success" })
                ? "light"
                : "default"
            }
          >
            <IconCircleCheckFilled size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Warning")}>
          <ActionIcon
            onClick={() => setCalloutType("warning")}
            size="lg"
            aria-label={t("Warning")}
            variant={
              editor.isActive("callout", { type: "warning" })
                ? "light"
                : "default"
            }
          >
            <IconAlertTriangleFilled size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Danger")}>
          <ActionIcon
            onClick={() => setCalloutType("danger")}
            size="lg"
            aria-label={t("Danger")}
            variant={
              editor.isActive("callout", { type: "danger" })
                ? "light"
                : "default"
            }
          >
            <IconCircleXFilled size={18} />
          </ActionIcon>
        </Tooltip>

        <EmojiPicker
          onEmojiSelect={setCalloutIcon}
          removeEmojiAction={removeCalloutIcon}
          readOnly={false}
          icon={currentIcon || <IconMoodSmile size={18} />}
          actionIconProps={{
            size: "lg",
            variant: "default",
            c: undefined,
          }}
        />
      </ActionIcon.Group>
    </BaseBubbleMenu>
  );
}

export default CalloutMenu;
