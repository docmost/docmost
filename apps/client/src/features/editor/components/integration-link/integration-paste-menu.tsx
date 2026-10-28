import {
  ActionIcon,
  Button,
  Paper,
  Stack,
  Text,
  Tooltip,
  VisuallyHidden,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCopy, IconExternalLink } from "@tabler/icons-react";
import { posToDOMRect, useEditorState } from "@tiptap/react";
import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { copyToClipboard } from "@docmost/editor-ext";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EditorMenuProps } from "@/features/editor/components/table/types/types.ts";
import { integrationPasteMenuKey } from "@/features/editor/extensions/integration-paste-menu";
import {
  convertIntegrationDisplay,
  getIntegrationCardAvailability,
  getSelectedIntegrationDisplay,
  type IntegrationDisplay,
  type IntegrationDisplaySource,
} from "./integration-display";
import { IntegrationDisplayPicker } from "./integration-display-picker";
import {
  convertCardToMicrosoftEmbed,
  isEmbeddableMicrosoftKind,
} from "@/features/microsoft/utils/convert-card";
import { queryClient } from "@/main.tsx";
import type {
  UnfurlNeedsConnection,
  UnfurlResult,
} from "@/features/integration/types/integration.types";
import classes from "./integration-paste-menu.module.css";

type PasteValue = IntegrationDisplay | "embed";

const PASTE_OPTIONS: { value: PasteValue; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "mention", label: "Mention" },
  { value: "url", label: "URL" },
];

const EMBED_OPTION: { value: PasteValue; label: string } = { value: "embed", label: "Embed" };

type DisplayTarget = {
  current: Exclude<IntegrationDisplay, "url">;
  source: Extract<IntegrationDisplaySource, { kind: "node" }>;
  url: string;
  isPaste: boolean;
  provider: string;
};

function canEmbedTarget(target: DisplayTarget | null): boolean {
  if (target?.provider !== "microsoft_365") return false;

  const cached = queryClient.getQueryData<
    UnfurlResult | UnfurlNeedsConnection | null
  >(["unfurl", target.url]);
  if (!cached) return true;
  if ("needsConnection" in cached) return true;
  return isEmbeddableMicrosoftKind(cached.metadata);
}

function getDisplayTarget(
  editor: EditorMenuProps["editor"],
): DisplayTarget | null {
  const pasteState = integrationPasteMenuKey.getState(editor.state);
  if (pasteState) {
    const node = editor.state.doc.nodeAt(pasteState.pos);
    const current =
      node?.type.name === "integrationCard"
        ? "card"
        : node?.type.name === "integrationMention"
          ? "mention"
          : null;

    if (current && typeof node?.attrs.url === "string") {
      return {
        current,
        source: {
          kind: "node",
          pos: pasteState.pos,
          joinBefore: pasteState.joinBefore,
          joinAfter: pasteState.joinAfter,
        },
        url: node.attrs.url,
        isPaste: true,
        provider: String(node.attrs.provider ?? ""),
      };
    }
  }

  const selected = getSelectedIntegrationDisplay(editor);
  return selected
    ? {
        ...selected,
        isPaste: false,
        provider: String(
          editor.state.doc.nodeAt(selected.source.pos)?.attrs.provider ?? "",
        ),
      }
    : null;
}

export function IntegrationPasteMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();
  const [selectedPasteIndex, setSelectedPasteIndex] = useState(0);
  const pasteOptionIdPrefix = useId();
  const promptRef = useRef<HTMLDivElement>(null);

  const target = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) =>
      currentEditor ? getDisplayTarget(currentEditor) : null,
  });

  const canEmbed = canEmbedTarget(target);

  const pasteOptions = canEmbed
    ? [...PASTE_OPTIONS, EMBED_OPTION]
    : PASTE_OPTIONS;

  const activeIndex = Math.min(
    selectedPasteIndex,
    Math.max(pasteOptions.length - 1, 0),
  );

  const findTarget = useCallback(() => getDisplayTarget(editor), [editor]);
  const shouldShow = useCallback(() => Boolean(findTarget()), [findTarget]);

  const getReferencedVirtualElement = useCallback(() => {
    const currentTarget = findTarget();
    if (!currentTarget) return undefined;

    const { pos } = currentTarget.source;
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
  }, [editor, findTarget]);

  const dismissPastePrompt = useCallback(() => {
    if (!integrationPasteMenuKey.getState(editor.state)) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(integrationPasteMenuKey, null),
    );

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

  const changeDisplay = useCallback(
    (display: PasteValue) => {
      const currentTarget = findTarget();
      if (!currentTarget) return;

      if (display === "embed") {
        dismissPastePrompt();
        void convertCardToMicrosoftEmbed(editor, currentTarget.source.pos);
        return;
      }

      dismissPastePrompt();
      if (display === currentTarget.current) {
        editor.commands.focus(undefined, { scrollIntoView: false });
        return;
      }

      if (convertIntegrationDisplay(editor, currentTarget.source, display)) {
        editor.commands.focus(undefined, { scrollIntoView: false });
      }
    },
    [dismissPastePrompt, editor, findTarget],
  );

  useEffect(() => {
    if (target?.isPaste) setSelectedPasteIndex(0);
  }, [target?.isPaste, target?.source.pos, pasteOptions.length]);

  // Focus stays in the editor, so capture keys before ProseMirror moves past the atom node.
  useEffect(() => {
    if (!target?.isPaste) return;

    const ownsFocus = () =>
      editor.view.hasFocus() ||
      Boolean(promptRef.current?.contains(document.activeElement));

    const onKeyDown = (event: KeyboardEvent) => {
      if (!ownsFocus()) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismissPastePrompt();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setSelectedPasteIndex(
          (activeIndex + delta + pasteOptions.length) % pasteOptions.length,
        );
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const option = pasteOptions[activeIndex];
        if (option) changeDisplay(option.value);
      }
    };

    // Leaving the editor dismisses the prompt, unless focus moved into the prompt itself.
    const onBlur = ({ event }: { event: FocusEvent }) => {
      const next = event.relatedTarget;
      if (next instanceof Node && promptRef.current?.contains(next)) return;
      if (editor.isDestroyed) return;
      editor.view.dispatch(
        editor.state.tr.setMeta(integrationPasteMenuKey, null),
      );
    };

    window.addEventListener("keydown", onKeyDown, true);
    editor.on("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      editor.off("blur", onBlur);
    };
  }, [
    changeDisplay,
    dismissPastePrompt,
    editor,
    selectedPasteIndex,
    target?.isPaste,
    pasteOptions.length,
  ]);

  const copyLink = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const currentTarget = findTarget();
      if (!currentTarget) return;

      copyToClipboard(currentTarget.url);
      notifications.show({ message: t("Link copied") });
    },
    [findTarget, t],
  );

  const cardAvailability = target
    ? getIntegrationCardAvailability(editor, target.source)
    : null;

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="integration-display-menu"
      updateDelay={0}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={{
        placement:
          target?.isPaste || target?.current !== "card"
            ? "bottom-start"
            : "top-end",
        offset: 10,
        flip: true,
        shift: true,
      }}
      shouldShow={shouldShow}
    >
      {target?.isPaste ? (
        <Paper
          ref={promptRef}
          shadow="md"
          radius="md"
          withBorder
          p={4}
          miw={140}
          role="listbox"
          aria-label={t("Paste as")}
          aria-orientation="vertical"
          aria-activedescendant={`${pasteOptionIdPrefix}-${pasteOptions[activeIndex].value}`}
        >
          <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
            {t(pasteOptions[activeIndex].label)}
          </VisuallyHidden>
          <Text size="xs" c="dimmed" px={8} py={4}>
            {t("Paste as")}
          </Text>
          <Stack gap={2}>
            {pasteOptions.map((option, index) => (
              <Button
                key={option.value}
                id={`${pasteOptionIdPrefix}-${option.value}`}
                role="option"
                aria-selected={index === activeIndex}
                variant={index === activeIndex ? "light" : "subtle"}
                color="gray"
                size="compact-sm"
                fullWidth
                justify="flex-start"
                className={classes.pasteOption}
                onMouseEnter={() => setSelectedPasteIndex(index)}
                onFocus={() => setSelectedPasteIndex(index)}
                onClick={() => changeDisplay(option.value)}
              >
                {t(option.label)}
              </Button>
            ))}
          </Stack>
        </Paper>
      ) : target ? (
        <div
          className={classes.toolbar}
          role="toolbar"
          aria-label={t("Integration link actions")}
        >
          <IntegrationDisplayPicker
            key={`${target.source.pos}-selected`}
            current={target.current}
            label={t("Display as")}
            canUseCard={cardAvailability?.canUseCard ?? false}
            onChange={changeDisplay}
          />
          {canEmbed && target.current === "card" ? (
            <Button
              size="compact-xs"
              variant="light"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={() => changeDisplay("embed")}
            >
              {t("Embed")}
            </Button>
          ) : null}
          <span className={classes.divider} aria-hidden="true" />
          <Tooltip label={t("Open link")} withArrow withinPortal={false}>
            <ActionIcon
              component="a"
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              variant="subtle"
              color="gray"
              size={32}
              className={classes.actionButton}
              aria-label={t("Open link")}
            >
              <IconExternalLink size={18} stroke={1.75} aria-hidden="true" />
            </ActionIcon>
          </Tooltip>
          {target.current === "mention" ? (
            <Tooltip label={t("Copy link")} withArrow withinPortal={false}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size={32}
                className={classes.actionButton}
                aria-label={t("Copy link")}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={copyLink}
              >
                <IconCopy size={18} stroke={1.75} aria-hidden="true" />
              </ActionIcon>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
    </BaseBubbleMenu>
  );
}
