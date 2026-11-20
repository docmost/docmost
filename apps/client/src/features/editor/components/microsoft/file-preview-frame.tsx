import { ActionIcon, Anchor, Loader, Text, Tooltip } from "@mantine/core";
import { useIntersection, useWindowEvent } from "@mantine/hooks";
import {
  IconExternalLink,
  IconFolder,
  IconMaximize,
  IconPencil,
  IconX,
} from "@tabler/icons-react";
import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { sanitizeMicrosoftFolderUrl, type MicrosoftFileItem } from "@docmost/editor-ext";
import { useM365Item, useM365Preview } from "@/features/microsoft/queries/microsoft-query";
import { fileTypeIcon } from "@/features/microsoft/utils/file-type-icon";
import { microsoftApp } from "@/features/microsoft/utils/microsoft-app";
import {
  isPreviewInView,
  PREVIEW_VISIBILITY_THRESHOLDS,
} from "@/features/microsoft/utils/preview-visibility";
import { microsoftFullscreenHostsAtom } from "@/features/microsoft/atoms/microsoft-atoms";
import { FileStateCard } from "./file-state-card";
import classes from "./microsoft-file.module.css";

// Nobody is using the viewer yet this soon after it loads, so focus it takes is its own
const VIEWER_FOCUS_GRACE_MS = 1000;

export function editUrl(webUrl: string): string {
  try {
    const url = new URL(webUrl);
    url.searchParams.set("web", "1");
    return url.toString();
  } catch {
    return webUrl;
  }
}

type Props = {
  item: MicrosoftFileItem;
  fill?: boolean;
  onFullscreen?: (item: MicrosoftFileItem) => void;
  onClose?: () => void;
};

export function FilePreviewFrame({ item, fill = false, onFullscreen, onClose }: Props) {
  const { t } = useTranslation();
  const name = item.name || item.webUrl;
  const app = microsoftApp(item.webUrl);
  const hosts = useAtomValue(microsoftFullscreenHostsAtom);
  const { ref, entry } = useIntersection<HTMLDivElement>({ threshold: PREVIEW_VISIBILITY_THRESHOLDS });
  const [seen, setSeen] = useState(fill);
  const retried = useRef(false);
  const [frameFailed, setFrameFailed] = useState(false);
  const frameLoadedRef = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const focusGuardUntil = useRef(Infinity);
  const focusBeforeViewer = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (entry && isPreviewInView(entry)) setSeen(true);
  }, [entry]);

  const preview = useM365Preview(item.driveId, item.itemId, seen);
  const meta = useM365Item(item.driveId, item.itemId, seen);
  const parentWebUrl = meta.state === "loaded" ? sanitizeMicrosoftFolderUrl(meta.data.parentWebUrl) : "";
  const mimeType = meta.state === "loaded" ? meta.data.mimeType : undefined;
  const getUrl = preview.state === "loaded" ? preview.data.getUrl : null;
  const previewUrl = getUrl?.startsWith("https://") ? getUrl : null;

  const handleFrameError = () => {
    if (!retried.current) {
      retried.current = true;
      setAttempt((n) => n + 1);
      preview.refetch();
      return;
    }
    setFrameFailed(true);
  };

  useEffect(() => {
    frameLoadedRef.current = false;
    focusGuardUntil.current = Infinity;
    if (!previewUrl) return;
    const timer = window.setTimeout(() => {
      if (!frameLoadedRef.current) handleFrameError();
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [previewUrl, attempt]);

  useWindowEvent("focusout", (event) => {
    const element = event.target;
    if (onClose || !(element instanceof HTMLElement)) return;
    // Once focus lands, keep the element only if the viewer took focus from it
    window.setTimeout(() => {
      focusBeforeViewer.current = document.activeElement === iframeRef.current ? element : null;
    }, 0);
  });

  // SharePoint's PDF viewer focuses itself on load, taking keys meant for the page or the modal
  useWindowEvent("blur", () => {
    if (document.activeElement !== iframeRef.current || Date.now() >= focusGuardUntil.current) return;
    // Taken back during this event, focus looks restored but keys still go to the frame
    window.setTimeout(() => {
      const viewer = iframeRef.current;
      if (!viewer || document.activeElement !== viewer) return;
      if (onClose) {
        closeRef.current?.focus();
        return;
      }
      focusBeforeViewer.current?.focus({ preventScroll: true });
      if (document.activeElement === viewer) viewer.blur();
    }, 0);
  });

  let body: ReactNode;
  if (preview.state === "anonymous") {
    body = <FileStateCard item={item} description={t("Sign in to Microsoft 365 to preview")} />;
  } else if (preview.state === "loading") {
    body = (
      <div className={classes.centered}>
        <Loader size="sm" />
      </div>
    );
  } else if (preview.state === "needsConnection") {
    body = (
      <FileStateCard
        item={item}
        description={t("Connect your Microsoft 365 account to preview this file")}
        needsConnection={preview.needsConnection}
      />
    );
  } else if (preview.state === "forbidden") {
    body = <FileStateCard item={item} description={t("You do not have access to this file in {{app}}", { app })} />;
  } else if (preview.state === "notFound") {
    body = <FileStateCard item={item} description={t("This file was moved or deleted")} />;
  } else if (preview.state === "error" || frameFailed || !previewUrl) {
    body = (
      <FileStateCard
        item={item}
        description={preview.state === "loaded" && !frameFailed ? t("Preview not available") : t("Could not load this file")}
      />
    );
  } else {
    body = (
      <iframe
        key={attempt}
        ref={iframeRef}
        className={classes.iframe}
        src={previewUrl}
        title={name}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        referrerPolicy="no-referrer"
        allowFullScreen
        onLoad={() => {
          frameLoadedRef.current = true;
          focusGuardUntil.current = Date.now() + VIEWER_FOCUS_GRACE_MS;
        }}
        onError={handleFrameError}
      />
    );
  }

  return (
    <div ref={seen ? undefined : ref} className={clsx(classes.frame, fill && classes.frameFill)}>
      <div className={classes.frameHeader}>
        {fileTypeIcon({ name: item.name, mimeType, size: 18 })}
        <Anchor
          href={item.webUrl}
          target="_blank"
          rel="noopener"
          size="sm"
          fw={500}
          truncate
          className={classes.frameTitle}
        >
          {name}
        </Anchor>
        <Tooltip label={t("Edit in {{app}}", { app })} withArrow>
          <ActionIcon
            component="a"
            href={editUrl(item.webUrl)}
            target="_blank"
            rel="noopener"
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={t("Edit {{name}} in {{app}}", { name, app })}
          >
            <IconPencil size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t("Open parent folder")} withArrow>
          <ActionIcon
            component="a"
            href={parentWebUrl || item.webUrl}
            target="_blank"
            rel="noopener"
            variant="subtle"
            color="gray"
            size="sm"
            disabled={!parentWebUrl}
            aria-label={t("Open parent folder of {{name}}", { name })}
          >
            <IconFolder size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t("Open in {{app}}", { app })} withArrow>
          <ActionIcon
            component="a"
            href={item.webUrl}
            target="_blank"
            rel="noopener"
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={t("Open {{name}} in {{app}}", { name, app })}
          >
            <IconExternalLink size={16} />
          </ActionIcon>
        </Tooltip>
        {onFullscreen && hosts > 0 && (
          <Tooltip label={t("Full screen")} withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={t("Show {{name}} full screen", { name })}
              onClick={() => onFullscreen(item)}
            >
              <IconMaximize size={16} />
            </ActionIcon>
          </Tooltip>
        )}
        {onClose && (
          <ActionIcon
            ref={closeRef}
            variant="subtle"
            color="gray"
            size="sm"
            data-autofocus
            aria-label={t("Close preview of {{name}}", { name })}
            onClick={onClose}
          >
            <IconX size={16} />
          </ActionIcon>
        )}
      </div>
      <div className={classes.frameBody}>{body}</div>
      {!seen && (
        <Text size="xs" c="dimmed" px="sm" py="xs">
          {t("Loading preview")}
        </Text>
      )}
    </div>
  );
}
