import { useCallback, useLayoutEffect, useReducer, useRef } from "react";
import { useInterval } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { MAIN_CONTENT_ID } from "@/components/ui/skip-to-main.tsx";
import { ANNOUNCEMENT_BANNERS_HEIGHT_VAR } from "@/ee/announcement/announcement.constants";
import {
  dismissAnnouncement,
  getAnnouncementFingerprint,
  isAnnouncementDismissed,
  isAnnouncementVisibleAt,
} from "@/ee/announcement/announcement.utils";
import { AnnouncementBanner } from "@/ee/announcement/components/announcement-banner";
import { useVisibleAnnouncementsQuery } from "@/ee/announcement/queries/announcement-query";
import type { AnnouncementSurface } from "@/ee/announcement/types/announcement.types";
import classes from "./announcement-banners.module.css";

type AnnouncementBannersProps = {
  surface: AnnouncementSurface;
  onHeightChange?: (height: number) => void;
};

export default function AnnouncementBanners({
  surface,
  onHeightChange,
}: AnnouncementBannersProps) {
  const { t } = useTranslation();
  const { data } = useVisibleAnnouncementsQuery(surface);
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const rootRef = useRef<HTMLDivElement>(null);
  const publishedHeightRef = useRef<number | null>(null);

  useInterval(rerender, 30_000, { autoInvoke: true });

  const now = Date.now();
  const banners = (data ?? []).filter(
    (announcement) =>
      isAnnouncementVisibleAt(announcement, now) &&
      !(announcement.isDismissible && isAnnouncementDismissed(announcement)),
  );
  const hasBanners = banners.length > 0;
  const bannersKey = banners
    .map(
      (announcement) =>
        `${announcement.id}:${getAnnouncementFingerprint(announcement)}`,
    )
    .join(",");

  const publishHeight = useCallback(() => {
    const height = rootRef.current.getBoundingClientRect().height;
    if (height === publishedHeightRef.current) {
      return;
    }
    publishedHeightRef.current = height;
    document.documentElement.style.setProperty(
      ANNOUNCEMENT_BANNERS_HEIGHT_VAR,
      `${height}px`,
    );
    onHeightChange?.(height);
  }, [onHeightChange]);

  // Before paint, so the header and sidebars never show a frame sized for other banners
  useLayoutEffect(() => {
    publishHeight();
  }, [bannersKey, publishHeight]);

  // A layout cleanup runs before a replacing layout's banners publish, so it cannot erase their height
  useLayoutEffect(() => {
    const observer = new ResizeObserver(publishHeight);
    observer.observe(rootRef.current);
    return () => {
      observer.disconnect();
      publishedHeightRef.current = null;
      document.documentElement.style.removeProperty(
        ANNOUNCEMENT_BANNERS_HEIGHT_VAR,
      );
      onHeightChange?.(0);
    };
  }, [publishHeight, onHeightChange]);

  return (
    <div
      ref={rootRef}
      className={classes.root}
      role={hasBanners ? "region" : undefined}
      aria-label={hasBanners ? t("Announcements") : undefined}
    >
      {banners.map((announcement) => (
        <AnnouncementBanner
          key={announcement.id}
          announcement={announcement}
          onDismiss={(event) => {
            const closeButtons = Array.from(
              rootRef.current.querySelectorAll("button"),
            );
            const nextFocus =
              closeButtons[closeButtons.indexOf(event.currentTarget) + 1] ??
              document.getElementById(MAIN_CONTENT_ID);
            dismissAnnouncement(announcement);
            nextFocus?.focus({ preventScroll: true });
            rerender();
          }}
        />
      ))}
    </div>
  );
}
