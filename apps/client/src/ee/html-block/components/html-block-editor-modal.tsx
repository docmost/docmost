import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Button,
  FileButton,
  Group,
  Modal,
  Skeleton,
  Tabs,
  Text,
  Tooltip,
  useComputedColorScheme,
} from "@mantine/core";
import {
  getHotkeyHandler,
  useMediaQuery,
  useWindowEvent,
} from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconRefresh, IconUpload } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import type { UploadTarget } from "@docmost/editor-ext";
import { lazyWithPrefetch } from "@/lib/lazy-prefetch.ts";
import { getApiErrorMessage } from "@/lib/api-error";
import { createHtmlBlock } from "@/ee/html-block/services/html-block-service";
import { htmlBlockQueryKey } from "@/ee/html-block/queries/html-block-query";
import { HtmlBlockFrame } from "@/ee/html-block/components/html-block-frame";
import { utf8ByteLength } from "@/ee/html-block/utils/html-block-height";
import { formatHtmlBlockSize } from "@/ee/html-block/utils/html-block-size";
import {
  HTML_BLOCK_EDITOR_SKELETON_WIDTHS,
  HTML_BLOCK_MAX_BYTES,
  HTML_BLOCK_PREVIEW_DELAY_MS,
} from "@/ee/html-block/html-block.constants";
import {
  IHtmlBlock,
  IHtmlBlockSaved,
} from "@/ee/html-block/types/html-block.types";
import classes from "./html-block-editor-modal.module.css";

const HtmlCodeEditor = lazyWithPrefetch(
  () => import("@/ee/html-block/components/html-code-editor"),
);

type HtmlBlockEditorModalProps = {
  opened: boolean;
  onClose: () => void;
  initialHtml: string;
  target: UploadTarget;
  previousId: string | null;
  onSaved: (saved: IHtmlBlockSaved, html: string) => void;
};

export function HtmlBlockEditorModal({
  opened,
  onClose,
  initialHtml,
  target,
  previousId,
  onSaved,
}: HtmlBlockEditorModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const colorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: false,
  });
  const isNarrow = useMediaQuery("(max-width: 800px)", false, {
    getInitialValueInEffect: false,
  });
  const contentRef = useRef<HTMLDivElement>(null);
  const resetUploadRef = useRef<() => void>(null);
  const [html, setHtml] = useState(initialHtml);
  const [previewHtml, setPreviewHtml] = useState(initialHtml);
  const [previewKey, setPreviewKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [saving, setSaving] = useState(false);
  const [wasOpened, setWasOpened] = useState(opened);

  if (opened !== wasOpened) {
    setWasOpened(opened);
    if (opened) {
      setHtml(initialHtml);
      setPreviewHtml(initialHtml);
      setActiveTab("code");
    }
  }

  useEffect(() => {
    const timer = setTimeout(
      () => setPreviewHtml(html),
      HTML_BLOCK_PREVIEW_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [html]);

  const size = useMemo(() => utf8ByteLength(html), [html]);
  const isOverLimit = size > HTML_BLOCK_MAX_BYTES;
  const isDirty = html !== initialHtml;
  const canSave = isDirty && /\S/.test(html) && !isOverLimit;

  const requestClose = () => {
    if (saving) return;
    if (!isDirty) {
      onClose();
      return;
    }

    modals.openConfirmModal({
      title: t("Unsaved changes"),
      children: (
        <Text size="sm">{t("You have unsaved changes. Discard them?")}</Text>
      ),
      centered: true,
      labels: { confirm: t("Discard"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: onClose,
    });
  };

  // Escape is handled here so the editor's search panel and selection, and the discard confirm, consume it first
  useWindowEvent("keydown", (event) => {
    if (!opened) return;
    const target = event.target as Node;
    const inDialog =
      target === document.body || contentRef.current?.contains(target);

    // the hotkey handler also keeps the browser's save dialog from opening while this one is open
    getHotkeyHandler([
      [
        "mod+S",
        () => {
          if (inDialog && canSave && !saving) handleSave();
        },
      ],
    ])(event);

    if (
      event.key === "Escape" &&
      !event.defaultPrevented &&
      !event.isComposing &&
      inDialog
    ) {
      requestClose();
    }
  });

  const handleUpload = async (file: File | null) => {
    resetUploadRef.current?.();
    if (!file) return;

    const showTooLarge = () =>
      notifications.show({
        message: t("HTML is larger than 5 MB."),
        color: "red",
      });
    if (file.size > HTML_BLOCK_MAX_BYTES) {
      showTooLarge();
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      notifications.show({
        message: t("Couldn't read this file."),
        color: "red",
      });
      return;
    }
    if (utf8ByteLength(text) > HTML_BLOCK_MAX_BYTES) {
      showTooLarge();
      return;
    }
    setHtml(text);
  };

  const handleSave = async () => {
    setSaving(true);
    let saved: IHtmlBlockSaved;
    try {
      saved = await createHtmlBlock({ target, previousId, html });
    } catch (err) {
      notifications.show({
        message: getApiErrorMessage(err, t("Failed to save HTML block")),
        color: "red",
      });
      return;
    } finally {
      setSaving(false);
    }

    queryClient.setQueryData<IHtmlBlock>(htmlBlockQueryKey(saved.id), {
      id: saved.id,
      pageId: saved.pageId,
      templateId: saved.templateId,
      content: html,
      createdAt: saved.createdAt,
    });
    onSaved(saved, html);
    onClose();
  };

  const refreshPreview = () => {
    setPreviewHtml(html);
    setPreviewKey((key) => key + 1);
  };

  const codeEditor = (
    <div className={classes.codeSurface}>
      <Suspense
        fallback={
          <div
            className={classes.editorSkeleton}
            role="status"
            aria-busy="true"
            aria-label={t("Loading editor")}
          >
            {HTML_BLOCK_EDITOR_SKELETON_WIDTHS.map((width, index) => (
              <div key={index} className={classes.skeletonLine}>
                <Skeleton height={8} width={14} />
                <Skeleton height={8} width={width} />
              </div>
            ))}
          </div>
        }
      >
        <HtmlCodeEditor
          value={html}
          onChange={setHtml}
          colorScheme={colorScheme}
          placeholder={t("Write or paste HTML here")}
        />
      </Suspense>
    </div>
  );

  const previewFrame = (
    <div className={classes.previewSurface}>
      {/\S/.test(previewHtml) ? (
        <HtmlBlockFrame
          key={previewKey}
          html={previewHtml}
          height="fill"
          title={t("HTML block preview")}
        />
      ) : (
        <div className={classes.previewEmpty}>
          <Text size="sm" c="dimmed">
            {t("The preview appears here.")}
          </Text>
        </div>
      )}
    </div>
  );

  const refreshButton = (
    <Tooltip label={t("Refresh preview")}>
      <ActionIcon
        variant="subtle"
        color="gray"
        onClick={refreshPreview}
        aria-label={t("Refresh preview")}
      >
        <IconRefresh size={16} />
      </ActionIcon>
    </Tooltip>
  );

  return (
    <Modal.Root
      opened={opened}
      onClose={requestClose}
      size={1400}
      fullScreen={isNarrow}
      centered
      closeOnEscape={false}
    >
      <Modal.Overlay />
      <Modal.Content ref={contentRef} classNames={{ content: classes.content }}>
        <Modal.Header>
          <Modal.Title>
            <Text component="span" size="md" fw={500}>
              {t("Edit HTML block")}
            </Text>
          </Modal.Title>
          <Group gap="md" wrap="nowrap">
            <Text size="xs" c={isOverLimit ? "red" : "dimmed"}>
              {t("{{size}} of 5 MB", { size: formatHtmlBlockSize(size) })}
            </Text>
            <Modal.CloseButton aria-label={t("Close")} />
          </Group>
        </Modal.Header>

        <div className={classes.body}>
          {isNarrow ? (
            <Tabs
              value={activeTab}
              onChange={(value) =>
                setActiveTab(value === "preview" ? "preview" : "code")
              }
              color="dark"
              keepMounted={false}
              keepMountedMode="display-none"
              className={classes.tabs}
            >
              <div className={classes.tabsBar}>
                <Tabs.List>
                  <Tabs.Tab value="code">{t("Code")}</Tabs.Tab>
                  <Tabs.Tab value="preview">{t("Preview")}</Tabs.Tab>
                </Tabs.List>
                {activeTab === "preview" && (
                  <div className={classes.tabsAction}>{refreshButton}</div>
                )}
              </div>
              <Tabs.Panel value="code" keepMounted className={classes.tabPanel}>
                {codeEditor}
              </Tabs.Panel>
              <Tabs.Panel value="preview" className={classes.tabPanel}>
                {previewFrame}
              </Tabs.Panel>
            </Tabs>
          ) : (
            <div className={classes.panes}>
              <div className={classes.pane}>{codeEditor}</div>
              <div className={clsx(classes.pane, classes.previewPane)}>
                <div className={classes.previewHeader}>
                  <Text component="h3" size="xs" c="dimmed" fw={500}>
                    {t("Preview")}
                  </Text>
                  {refreshButton}
                </div>
                <div className={classes.previewBody}>{previewFrame}</div>
              </div>
            </div>
          )}

          <Group justify="space-between" wrap="nowrap" className={classes.footer}>
            <FileButton
              onChange={handleUpload}
              accept=".html,.htm,text/html"
              resetRef={resetUploadRef}
              disabled={saving}
            >
              {(props) => (
                <Button
                  {...props}
                  variant="subtle"
                  color="gray"
                  leftSection={<IconUpload size={16} />}
                  disabled={saving}
                >
                  {t("Upload .html")}
                </Button>
              )}
            </FileButton>
            <Group gap="sm" wrap="nowrap">
              <Button variant="default" onClick={requestClose} disabled={saving}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleSave} loading={saving} disabled={!canSave}>
                {t("Save")}
              </Button>
            </Group>
          </Group>
        </div>
      </Modal.Content>
    </Modal.Root>
  );
}
