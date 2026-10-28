import { ActionIcon, Anchor, Loader, Text, Tooltip } from "@mantine/core";
import { useIntersection } from "@mantine/hooks";
import {
  IconExternalLink,
  IconFolder,
  IconMaximize,
  IconPencil,
} from "@tabler/icons-react";
import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import type { MicrosoftFileItem } from "@docmost/editor-ext";
import { useM365Item, useM365Preview } from "@/features/microsoft/queries/microsoft-query";
import { fileTypeIcon } from "@/features/microsoft/utils/file-type-icon";
import {
  isPreviewInView,
  PREVIEW_VISIBILITY_THRESHOLDS,
} from "@/features/microsoft/utils/preview-visibility";
import { microsoftFullscreenHostsAtom } from "@/features/microsoft/atoms/microsoft-atoms";
import { FileStateCard } from "./file-state-card";
import classes from "./microsoft-file.module.css";

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
};

export function FilePreviewFrame({ item, fill = false, onFullscreen }: Props) {
  const { t } = useTranslation();
  const hosts = useAtomValue(microsoftFullscreenHostsAtom);
  const { ref, entry } = useIntersection<HTMLDivElement>({ threshold: PREVIEW_VISIBILITY_THRESHOLDS });
  const [seen, setSeen] = useState(fill);
  const retried = useRef(false);
  const [frameFailed, setFrameFailed] = useState(false);
  const frameLoadedRef = useRef(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (entry && isPreviewInView(entry)) setSeen(true);
  }, [entry]);

  const preview = useM365Preview(item.driveId, item.itemId, seen);
  const meta = useM365Item(item.driveId, item.itemId, seen);
  const parentWebUrl = meta.state === "loaded" ? meta.data.parentWebUrl : undefined;
  const mimeType = meta.state === "loaded" ? meta.data.mimeType : undefined;
  const previewUrl = preview.state === "loaded" ? preview.data.getUrl : null;

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
    if (!previewUrl) return;
    const timer = window.setTimeout(() => {
      if (!frameLoadedRef.current) handleFrameError();
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [previewUrl, attempt]);

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
    body = <FileStateCard item={item} description={t("You do not have access to this file in SharePoint")} />;
  } else if (preview.state === "notFound") {
    body = <FileStateCard item={item} description={t("This file was moved or deleted")} />;
  } else if (preview.state === "error" || frameFailed || !preview.data.getUrl) {
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
        className={classes.iframe}
        src={preview.data.getUrl}
        title={item.name}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        referrerPolicy="no-referrer"
        allowFullScreen
        onLoad={() => {
          frameLoadedRef.current = true;
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
          {item.name || item.webUrl}
        </Anchor>
        <Tooltip label={t("Edit in SharePoint")} withArrow>
          <ActionIcon
            component="a"
            href={editUrl(item.webUrl)}
            target="_blank"
            rel="noopener"
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={t("Edit in SharePoint")}
          >
            <IconPencil size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t("Open parent folder")} withArrow>
          <ActionIcon
            component="a"
            href={parentWebUrl ?? item.webUrl}
            target="_blank"
            rel="noopener"
            variant="subtle"
            color="gray"
            size="sm"
            disabled={!parentWebUrl}
            aria-label={t("Open parent folder")}
          >
            <IconFolder size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t("Open in SharePoint")} withArrow>
          <ActionIcon
            component="a"
            href={item.webUrl}
            target="_blank"
            rel="noopener"
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={t("Open in SharePoint")}
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
              aria-label={t("Full screen")}
              onClick={() => onFullscreen(item)}
            >
              <IconMaximize size={16} />
            </ActionIcon>
          </Tooltip>
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
