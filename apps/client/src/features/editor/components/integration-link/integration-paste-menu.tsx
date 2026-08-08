import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { posToDOMRect, useEditorState } from "@tiptap/react";
import { useCallback, useEffect } from "react";
import { Button, Paper, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { EditorMenuProps } from "@/features/editor/components/table/types/types.ts";
import { integrationPasteMenuKey } from "@/features/editor/extensions/integration-paste-menu";

const INTEGRATION_NODE_TYPES = ["integrationLink", "integrationMention"];

export function IntegrationPasteMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();

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

  useEffect(() => {
    if (!menuState) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuState, dismiss]);

  const convert = useCallback(
    (target: "preview" | "mention" | "url") => {
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

      if (target === "preview" && !isBlock) {
        editor
          .chain()
          .focus(undefined, { scrollIntoView: false })
          .deleteRange({ from, to })
          .insertContentAt(from, { type: "integrationLink", attrs })
          .run();
      } else if (target === "mention" && isBlock) {
        editor
          .chain()
          .focus(undefined, { scrollIntoView: false })
          .deleteRange({ from, to })
          .insertContentAt(from, {
            type: "paragraph",
            content: [
              { type: "integrationMention", attrs },
              { type: "text", text: " " },
            ],
          })
          .run();
      } else if (target === "url") {
        const linkText = {
          type: "text",
          text: attrs.url,
          marks: [{ type: "link", attrs: { href: attrs.url } }],
        };
        editor
          .chain()
          .focus(undefined, { scrollIntoView: false })
          .deleteRange({ from, to })
          .insertContentAt(
            from,
            isBlock ? { type: "paragraph", content: [linkText] } : linkText,
          )
          .run();
      } else {
        // already in the requested form
        dismiss();
      }
    },
    [editor, findTarget, dismiss],
  );

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="integration-paste-menu"
      updateDelay={0}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={{ placement: "bottom-start", flip: true }}
      shouldShow={shouldShow}
    >
      <Paper shadow="md" radius="md" withBorder p={4} miw={140}>
        <Text size="xs" c="dimmed" px={8} py={4}>
          {t("Paste as")}
        </Text>
        <Stack gap={2}>
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            fullWidth
            justify="flex-start"
            onClick={() => convert("preview")}
          >
            {t("Preview")}
          </Button>
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            fullWidth
            justify="flex-start"
            onClick={() => convert("mention")}
          >
            {t("Mention")}
          </Button>
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            fullWidth
            justify="flex-start"
            onClick={() => convert("url")}
          >
            {t("URL")}
          </Button>
        </Stack>
      </Paper>
    </BaseBubbleMenu>
  );
}
