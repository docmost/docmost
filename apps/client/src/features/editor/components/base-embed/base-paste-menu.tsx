import { Button, Paper, Text, VisuallyHidden } from "@mantine/core";
import { posToDOMRect, useEditorState } from "@tiptap/react";
import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EditorMenuProps } from "@/features/editor/components/table/types/types.ts";
import { basePasteMenuKey } from "@/features/editor/extensions/base-paste-menu";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { convertMentionToBaseEmbed } from "./convert-mention-to-base-embed";
import classes from "../integration-link/integration-paste-menu.module.css";

function getPastedBasePos(editor: EditorMenuProps["editor"]): number | null {
  const pasteState = basePasteMenuKey.getState(editor.state);
  if (!pasteState) return null;
  const node = editor.state.doc.nodeAt(pasteState.pos);
  return node?.type.name === "mention" ? pasteState.pos : null;
}

export function BasePasteMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();
  const hasBases = useHasFeature(Feature.BASES);
  const [highlighted, setHighlighted] = useState(false);
  const optionId = useId();
  const promptRef = useRef<HTMLDivElement>(null);

  const pastedPos = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) =>
      currentEditor ? getPastedBasePos(currentEditor) : null,
  });
  const isOpen = hasBases && pastedPos !== null;

  const shouldShow = useCallback(
    () => hasBases && getPastedBasePos(editor) !== null,
    [editor, hasBases],
  );

  const getReferencedVirtualElement = useCallback(() => {
    const pos = getPastedBasePos(editor);
    if (pos === null) return undefined;
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return undefined;

    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    const domRect =
      dom?.getBoundingClientRect?.() ??
      posToDOMRect(editor.view, pos, pos + node.nodeSize);

    return {
      getBoundingClientRect: () => domRect,
      getClientRects: () => [domRect],
    };
  }, [editor]);

  const dismiss = useCallback(() => {
    if (!basePasteMenuKey.getState(editor.state)) return;
    editor.view.dispatch(editor.state.tr.setMeta(basePasteMenuKey, null));

    requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (
        !activeElement ||
        activeElement === document.body ||
        !activeElement.isConnected
      ) {
        editor.commands.focus(undefined, { scrollIntoView: false });
      }
    });
  }, [editor]);

  const embed = useCallback(() => {
    const pos = getPastedBasePos(editor);
    if (pos === null) return;

    dismiss();
    if (convertMentionToBaseEmbed(editor, pos)) {
      editor.commands.focus(undefined, { scrollIntoView: false });
    }
  }, [dismiss, editor]);

  useEffect(() => setHighlighted(false), [pastedPos]);

  // Focus stays in the editor, so capture keys before ProseMirror handles them.
  useEffect(() => {
    if (!isOpen) return;

    const ownsFocus = () =>
      editor.view.hasFocus() ||
      Boolean(promptRef.current?.contains(document.activeElement));

    const onKeyDown = (event: KeyboardEvent) => {
      if (!ownsFocus()) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setHighlighted(true);
        return;
      }

      // Until the option is highlighted, Enter is still a new line.
      if (event.key === "Enter" && highlighted) {
        event.preventDefault();
        event.stopPropagation();
        embed();
      }
    };

    // Leaving the editor dismisses the prompt, unless focus moved into the prompt itself.
    const onBlur = ({ event }: { event: FocusEvent }) => {
      const next = event.relatedTarget;
      if (next instanceof Node && promptRef.current?.contains(next)) return;
      if (editor.isDestroyed) return;
      editor.view.dispatch(editor.state.tr.setMeta(basePasteMenuKey, null));
    };

    window.addEventListener("keydown", onKeyDown, true);
    editor.on("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      editor.off("blur", onBlur);
    };
  }, [dismiss, editor, embed, highlighted, isOpen]);

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="base-paste-menu"
      updateDelay={0}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={{
        placement: "bottom-start",
        offset: 10,
        flip: true,
        shift: true,
      }}
      shouldShow={shouldShow}
    >
      {isOpen ? (
        <Paper
          ref={promptRef}
          shadow="md"
          radius="md"
          withBorder
          p={4}
          miw={140}
          role="listbox"
          aria-label={t("Paste as")}
          aria-activedescendant={highlighted ? optionId : undefined}
        >
          <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
            {highlighted ? t("Inline base") : ""}
          </VisuallyHidden>
          <Text size="xs" c="dimmed" px={8} py={4}>
            {t("Paste as")}
          </Text>
          <Button
            id={optionId}
            role="option"
            aria-selected={highlighted}
            variant={highlighted ? "light" : "subtle"}
            color="gray"
            size="compact-sm"
            fullWidth
            justify="flex-start"
            className={classes.pasteOption}
            onMouseEnter={() => setHighlighted(true)}
            onMouseLeave={() => setHighlighted(false)}
            onFocus={() => setHighlighted(true)}
            onClick={embed}
          >
            {t("Inline base")}
          </Button>
        </Paper>
      ) : null}
    </BaseBubbleMenu>
  );
}
