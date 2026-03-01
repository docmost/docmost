import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { findParentNode, posToDOMRect, useEditorState } from "@tiptap/react";
import React, { useCallback } from "react";
import { Node as PMNode } from "@tiptap/pm/model";
import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types.ts";
import { ActionIcon, Tooltip } from "@mantine/core";
import clsx from "clsx";
import {
  IconAlertTriangleFilled,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconInfoCircleFilled,
  IconMoodSmile,
  IconNotes,
} from "@tabler/icons-react";
import { CalloutType, isTextSelected } from "@docmost/editor-ext";
import { useTranslation } from "react-i18next";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import classes from "../common/toolbar-menu.module.css";

export function CalloutMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) {
        return false;
      }
      if (isTextSelected(editor)) return false;

      return editor.isActive("callout");
    },
    [editor],
  );

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return null;
      }

      return {
        isCallout: ctx.editor.isActive("callout"),
        isInfo: ctx.editor.isActive("callout", { type: "info" }),
        isNote: ctx.editor.isActive("callout", { type: "note" }),
        isSuccess: ctx.editor.isActive("callout", { type: "success" }),
        isWarning: ctx.editor.isActive("callout", { type: "warning" }),
        isDanger: ctx.editor.isActive("callout", { type: "danger" }),
      };
    },
  });

  const getReferencedVirtualElement = useCallback(() => {
    if (!editor) return;
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "callout";
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
      pluginKey={`callout-menu`}
      updateDelay={0}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={{
        placement: "bottom",
        // offset: 233, //      //         offset: [0, 10],
        // zIndex: 99,
        flip: false,
      }}
      shouldShow={shouldShow}
    >
      <div className={classes.toolbar}>
        <Tooltip position="top" label={t("Info")} withinPortal={false}>
          <ActionIcon
            onClick={() => setCalloutType("info")}
            size="lg"
            aria-label={t("Info")}
            variant="subtle"
            className={clsx({ [classes.active]: editorState?.isInfo })}
          >
            <IconInfoCircleFilled
              size={18}
              color="var(--mantine-color-blue-5)"
            />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Note")} withinPortal={false}>
          <ActionIcon
            onClick={() => setCalloutType("note")}
            size="lg"
            aria-label={t("Note")}
            variant="subtle"
            className={clsx({ [classes.active]: editorState?.isNote })}
          >
            <IconNotes size={18} color="var(--mantine-color-grape-5)" />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Success")} withinPortal={false}>
          <ActionIcon
            onClick={() => setCalloutType("success")}
            size="lg"
            aria-label={t("Success")}
            variant="subtle"
            className={clsx({ [classes.active]: editorState?.isSuccess })}
          >
            <IconCircleCheckFilled
              size={18}
              color="var(--mantine-color-green-5)"
            />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Warning")} withinPortal={false}>
          <ActionIcon
            onClick={() => setCalloutType("warning")}
            size="lg"
            aria-label={t("Warning")}
            variant="subtle"
            className={clsx({ [classes.active]: editorState?.isWarning })}
          >
            <IconAlertTriangleFilled
              size={18}
              color="var(--mantine-color-orange-5)"
            />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Danger")} withinPortal={false}>
          <ActionIcon
            onClick={() => setCalloutType("danger")}
            size="lg"
            aria-label={t("Danger")}
            variant="subtle"
            className={clsx({ [classes.active]: editorState?.isDanger })}
          >
            <IconCircleXFilled size={18} color="var(--mantine-color-red-5)" />
          </ActionIcon>
        </Tooltip>

        <EmojiPicker
          onEmojiSelect={setCalloutIcon}
          removeEmojiAction={removeCalloutIcon}
          readOnly={false}
          icon={currentIcon || <IconMoodSmile size={18} />}
          actionIconProps={{
            size: "lg",
            variant: "subtle",
          }}
        />
      </div>
    </BaseBubbleMenu>
  );
}

export default CalloutMenu;
