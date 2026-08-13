import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { posToDOMRect, useEditorState } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Paper,
  Stack,
  Text,
  VisuallyHidden,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import { EditorMenuProps } from "@/features/editor/components/table/types/types.ts";
import { integrationPasteMenuKey } from "@/features/editor/extensions/integration-paste-menu";

const INTEGRATION_NODE_TYPES = ["integrationLink", "integrationMention"];

type PasteTarget = "card" | "mention" | "url";

const PASTE_OPTIONS: { target: PasteTarget; label: string }[] = [
  { target: "card", label: "Card" },
  { target: "mention", label: "Mention" },
  { target: "url", label: "URL" },
];

export function IntegrationPasteMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const menuState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) return null;
      return integrationPasteMenuKey.getState(ctx.editor.state) ?? null;
    },
  });

  const findTarget = useCallback(() => {
    const state = integrationPasteMenuKey.getState(editor.state);
    if (!state) return null;
    const node = editor.state.doc.nodeAt(state.pos);
    if (!node || !INTEGRATION_NODE_TYPES.includes(node.type.name)) return null;
    return { node, pos: state.pos };
  }, [editor]);

  const shouldShow = useCallback(() => Boolean(findTarget()), [findTarget]);

  const getReferencedVirtualElement = useCallback(() => {
    const target = findTarget();
    if (!target) return undefined;
    const dom = editor.view.nodeDOM(target.pos) as HTMLElement | null;
    const domRect =
      dom?.getBoundingClientRect?.() ??
      posToDOMRect(
        editor.view,
        target.pos,
        target.pos + target.node.nodeSize,
      );
    return {
      getBoundingClientRect: () => domRect,
      getClientRects: () => [domRect],
    };
  }, [editor, findTarget]);

  const dismiss = useCallback(() => {
    editor.view.dispatch(
      editor.state.tr.setMeta(integrationPasteMenuKey, null),
    );
  }, [editor]);

  const convert = useCallback(
    (target: PasteTarget) => {
      const found = findTarget();
      if (!found) {
        dismiss();
        return;
      }
      const { node, pos } = found;
      const attrs = { ...node.attrs };
      const from = pos;
      const to = pos + node.nodeSize;
      const isBlock = node.type.name === "integrationLink";

      // Always replace, even when the node is already in the requested form:
      // the menu closes via the doc change, and BubbleMenu never re-evaluates
      // on meta-only transactions, so a bare dismiss would leave it stuck.
      let content: Record<string, any>;
      if (target === "card") {
        content = { type: "integrationLink", attrs };
      } else if (target === "mention") {
        const mention = { type: "integrationMention", attrs };
        content = isBlock
          ? {
              type: "paragraph",
              content: [mention, { type: "text", text: " " }],
            }
          : mention;
      } else {
        const linkText = {
          type: "text",
          text: attrs.url,
          marks: [{ type: "link", attrs: { href: attrs.url } }],
        };
        content = isBlock
          ? { type: "paragraph", content: [linkText] }
          : linkText;
      }

      editor
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .deleteRange({ from, to })
        .insertContentAt(from, content)
        .run();
    },
    [editor, findTarget, dismiss],
  );

  useEffect(() => {
    if (menuState) setSelectedIndex(0);
  }, [menuState]);

  // DOM focus stays in the editor (as with the slash menu); keys are handled
  // here. Capture phase, because ProseMirror itself consumes arrow keys next
  // to atom nodes (gap cursor / node selection) before they would bubble.
  useEffect(() => {
    if (!menuState) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setSelectedIndex(
          (prev) =>
            (prev + delta + PASTE_OPTIONS.length) % PASTE_OPTIONS.length,
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        convert(PASTE_OPTIONS[selectedIndex].target);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [menuState, dismiss, convert, selectedIndex]);

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="integration-paste-menu"
      updateDelay={0}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={{ placement: "bottom-start", flip: true }}
      shouldShow={shouldShow}
    >
      {/* Content is gated on the plugin state too: meta-only dismissals
          (Escape) are invisible to BubbleMenu's update cycle. */}
      {menuState ? (
      <Paper
        shadow="md"
        radius="md"
        withBorder
        p={4}
        miw={140}
        role="listbox"
        aria-label={t("Paste as")}
        aria-activedescendant={`integration-paste-option-${PASTE_OPTIONS[selectedIndex].target}`}
      >
        <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
          {t(PASTE_OPTIONS[selectedIndex].label)}
        </VisuallyHidden>
        <Text size="xs" c="dimmed" px={8} py={4}>
          {t("Paste as")}
        </Text>
        <Stack gap={2}>
          {PASTE_OPTIONS.map((option, index) => (
            <Button
              key={option.target}
              id={`integration-paste-option-${option.target}`}
              role="option"
              aria-selected={index === selectedIndex}
              variant={index === selectedIndex ? "light" : "subtle"}
              color="gray"
              size="compact-sm"
              fullWidth
              justify="flex-start"
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => convert(option.target)}
            >
              {t(option.label)}
            </Button>
          ))}
        </Stack>
      </Paper>
      ) : null}
    </BaseBubbleMenu>
  );
}
