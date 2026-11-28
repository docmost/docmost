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
import { IconCopy, IconExternalLink, IconRefresh } from "@tabler/icons-react";
import type { Transaction } from "@tiptap/pm/state";
import { posToDOMRect, useEditorState } from "@tiptap/react";
import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { copyToClipboard, sanitizeLinkPreviewUrl } from "@docmost/editor-ext";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EditorMenuProps } from "@/features/editor/components/table/types/types.ts";
import { linkPasteMenuKey } from "@/features/editor/extensions/link-paste-menu";
import {
  convertLinkDisplay,
  getLinkDisplayCardAvailability,
  getSelectedLinkDisplay,
  type LinkDisplay,
  type LinkDisplaySource,
} from "@/features/editor/utils/link-display";
import { getLinkPreview } from "@/features/link-preview/services/link-preview-service";
import { isLinkPreviewDisabled } from "@/lib/config";
import { queryClient } from "@/main.tsx";
import { IntegrationDisplayPicker } from "../integration-link/integration-display-picker";
import {
  canEmbedLink,
  convertLinkToEmbed,
  LINK_PREVIEW_NODES,
} from "./link-preview-display";
import { markLinkPreviewPending } from "./link-preview-pending";
import { linkPreviewQueryKey } from "./use-link-preview-fill";
import classes from "../integration-link/integration-paste-menu.module.css";

const MENU_PLUGIN_KEY = "link-preview-menu";

type PasteValue = LinkDisplay | "embed";

const PASTE_OPTIONS: { value: PasteValue; label: string }[] = [
  { value: "url", label: "URL" },
  { value: "mention", label: "Mention" },
  { value: "card", label: "Card" },
  { value: "embed", label: "Embed" },
];

// A just-pasted link, still a URL, or a selected card or mention.
type DisplayTarget =
  | {
      current: "url";
      source: Extract<LinkDisplaySource, { kind: "link" }>;
      url: string;
    }
  | {
      current: Exclude<LinkDisplay, "url">;
      source: Extract<LinkDisplaySource, { kind: "node" }>;
      url: string;
    };

function getDisplayTarget(
  editor: EditorMenuProps["editor"],
): DisplayTarget | null {
  const pasteState = linkPasteMenuKey.getState(editor.state);
  if (pasteState) {
    const { from, to, url } = pasteState;
    return {
      current: "url",
      source: { kind: "link", from, to, url, attrs: { url } },
      url,
    };
  }

  return getSelectedLinkDisplay(editor, LINK_PREVIEW_NODES);
}

export function LinkPasteMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();
  const [selectedPasteIndex, setSelectedPasteIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pasteOptionIdPrefix = useId();
  const promptRef = useRef<HTMLDivElement>(null);

  const target = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) =>
      currentEditor ? getDisplayTarget(currentEditor) : null,
  });

  const canUseCard = target
    ? getLinkDisplayCardAvailability(editor, target.source, LINK_PREVIEW_NODES)
        .canUseCard
    : false;

  const canEmbed =
    target?.current === "url" ? canEmbedLink(editor, target.source) : false;

  const pasteOptions = PASTE_OPTIONS.filter(
    (option) =>
      (option.value !== "card" || canUseCard) &&
      (option.value !== "embed" || canEmbed),
  );

  const previewsDisabled = isLinkPreviewDisabled();

  const activeIndex = Math.min(
    selectedPasteIndex,
    Math.max(pasteOptions.length - 1, 0),
  );

  const isPaste = target?.current === "url";
  const pasteFrom = isPaste ? target.source.from : null;
  const safeUrl = sanitizeLinkPreviewUrl(target?.url);

  const findTarget = useCallback(() => getDisplayTarget(editor), [editor]);
  const shouldShow = useCallback(() => Boolean(findTarget()), [findTarget]);

  const measureTarget = useCallback((): DOMRect | null => {
    const currentTarget = findTarget();
    if (!currentTarget) return null;

    if (currentTarget.current === "url") {
      const { from, to } = currentTarget.source;
      return posToDOMRect(editor.view, from, to);
    }

    const { pos } = currentTarget.source;
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return null;

    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    return (
      dom?.getBoundingClientRect?.() ??
      posToDOMRect(editor.view, pos, pos + node.nodeSize)
    );
  }, [editor, findTarget]);

  const getReferencedVirtualElement = useCallback(() => {
    let lastRect = measureTarget();
    if (!lastRect) return undefined;

    // Measured on every call: the pasted link renders a moment after the paste.
    const getRect = () => {
      lastRect = measureTarget() ?? lastRect;
      return lastRect;
    };

    return {
      getBoundingClientRect: getRect,
      getClientRects: () => [getRect()],
    };
  }, [measureTarget]);

  // Place the prompt again once the pasted link's view has rendered.
  useEffect(() => {
    if (pasteFrom === null) return;

    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        editor.view.dispatch(
          editor.state.tr.setMeta(MENU_PLUGIN_KEY, "updatePosition"),
        );
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [editor, pasteFrom]);

  const dismissPastePrompt = useCallback(() => {
    if (!linkPasteMenuKey.getState(editor.state)) return;
    editor.view.dispatch(editor.state.tr.setMeta(linkPasteMenuKey, null));

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

      dismissPastePrompt();
      if (display === currentTarget.current) {
        editor.commands.focus(undefined, { scrollIntoView: false });
        return;
      }

      if (display === "embed") {
        if (
          currentTarget.source.kind === "link" &&
          convertLinkToEmbed(editor, currentTarget.source)
        ) {
          editor.commands.focus(undefined, { scrollIntoView: false });
        }
        return;
      }

      // A node view fills its preview only when its URL was marked before it mounted.
      if (currentTarget.source.kind === "link") {
        markLinkPreviewPending(editor, currentTarget.url);
      }
      if (
        convertLinkDisplay(
          editor,
          currentTarget.source,
          display,
          LINK_PREVIEW_NODES,
        )
      ) {
        editor.commands.focus(undefined, { scrollIntoView: false });
      }
    },
    [dismissPastePrompt, editor, findTarget],
  );

  useEffect(() => {
    if (isPaste) setSelectedPasteIndex(0);
  }, [isPaste, pasteFrom, pasteOptions.length]);

  // Focus stays in the editor, so capture keys before ProseMirror handles them.
  useEffect(() => {
    if (!isPaste) return;

    const ownsFocus = () =>
      editor.view.hasFocus() ||
      Boolean(promptRef.current?.contains(document.activeElement));

    const onKeyDown = (event: KeyboardEvent) => {
      if (editor.isDestroyed || !ownsFocus()) return;

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
      editor.view.dispatch(editor.state.tr.setMeta(linkPasteMenuKey, null));
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
    isPaste,
    pasteOptions.length,
  ]);

  const copyLink = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const url = sanitizeLinkPreviewUrl(findTarget()?.url);
      if (!url) return;

      copyToClipboard(url);
      notifications.show({ message: t("Link copied") });
    },
    [findTarget, t],
  );

  const refreshPreview = useCallback(async () => {
    const currentTarget = findTarget();
    if (!currentTarget || currentTarget.current === "url") return;

    const { current, url } = currentTarget;
    let pos = currentTarget.source.pos;
    const followNode = ({
      transaction,
      appendedTransactions,
    }: {
      transaction: Transaction;
      appendedTransactions: Transaction[];
    }) => {
      for (const tr of [transaction, ...appendedTransactions]) {
        pos = tr.mapping.map(pos);
      }
    };

    setIsRefreshing(true);
    editor.on("transaction", followNode);
    const preview = await getLinkPreview({ url, refresh: true }).catch(
      () => null,
    );
    editor.off("transaction", followNode);
    setIsRefreshing(false);
    if (editor.isDestroyed) return;

    if (!preview) {
      notifications.show({
        message: t("Couldn't refresh the preview"),
        color: "red",
      });
      return;
    }

    const node = editor.state.doc.nodeAt(pos);
    if (
      node?.type.name === LINK_PREVIEW_NODES[current] &&
      node.attrs.url === url
    ) {
      // Attribute steps keep a selected mention selected; setNodeMarkup replaces the node.
      const tr = editor.state.tr;
      const fresh = { description: null, image: null, icon: null, ...preview };
      for (const [key, value] of Object.entries(fresh)) {
        if (node.attrs[key] !== value) tr.setNodeAttribute(pos, key, value);
      }
      editor.view.dispatch(tr);
    }
    queryClient.setQueryData(linkPreviewQueryKey(url), preview);
  }, [editor, findTarget, t]);

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey={MENU_PLUGIN_KEY}
      ref={(element) => {
        if (element) element.style.zIndex = "99";
      }}
      updateDelay={0}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={{
        placement: target?.current === "card" ? "top-end" : "bottom-start",
        offset: 10,
        flip: true,
        shift: true,
      }}
      shouldShow={shouldShow}
    >
      {isPaste ? (
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
          aria-label={t("Link actions")}
        >
          <IntegrationDisplayPicker
            key={`${target.source.pos}-selected`}
            current={target.current}
            label={t("Display as")}
            canUseCard={canUseCard}
            onChange={changeDisplay}
          />
          {editor.isEditable && !previewsDisabled ? (
            <Tooltip label={t("Refresh preview")} withArrow withinPortal={false}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size={32}
                className={classes.actionButton}
                aria-label={t("Refresh preview")}
                loading={isRefreshing}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={() => void refreshPreview()}
              >
                <IconRefresh size={18} stroke={1.75} aria-hidden="true" />
              </ActionIcon>
            </Tooltip>
          ) : null}
          {safeUrl ? (
            <>
              <span className={classes.divider} aria-hidden="true" />
              <Tooltip label={t("Open link")} withArrow withinPortal={false}>
                <ActionIcon
                  component="a"
                  href={safeUrl}
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
            </>
          ) : null}
        </div>
      ) : null}
    </BaseBubbleMenu>
  );
}
