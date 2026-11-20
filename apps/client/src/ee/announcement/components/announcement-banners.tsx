import {
  useCallback,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { useInterval } from "@mantine/hooks";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { MAIN_CONTENT_ID } from "@/components/ui/skip-to-main.tsx";
import {
  ANNOUNCEMENT_BANNERS_HEIGHT_VAR,
  ANNOUNCEMENT_MAX_VISIBLE,
} from "@/ee/announcement/announcement.constants";
import {
  dismissAnnouncement,
  getAnnouncementFingerprint,
  isAnnouncementDismissed,
  isAnnouncementVisibleAt,
} from "@/ee/announcement/announcement.utils";
import { announcementBannersHeightAtom } from "@/ee/announcement/atoms/announcement-atoms";
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
  const items = data?.items ?? [];
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const rootRef = useRef<HTMLDivElement>(null);
  const setBannersHeight = useSetAtom(announcementBannersHeightAtom);
  const [overflowing, setOverflowing] = useState(false);
  const publishedHeightRef = useRef<number | null>(null);

  useInterval(rerender, 30_000, { autoInvoke: true });

  const now = Date.now() + (data?.offsetMs ?? 0);
  // Dismissed items drop last, so dismissing the newest never brings back the one it replaced
  const banners = items
    .filter((announcement) => isAnnouncementVisibleAt(announcement, now))
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
    .slice(0, ANNOUNCEMENT_MAX_VISIBLE)
    .filter(
      (announcement) =>
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
    const root = rootRef.current;
    // The stack is capped, so overflow can change while the height stays put
    setOverflowing(root.scrollHeight > root.clientHeight);
    const height = root.getBoundingClientRect().height;
    if (height === publishedHeightRef.current) {
      return;
    }
    publishedHeightRef.current = height;
    document.documentElement.style.setProperty(
      ANNOUNCEMENT_BANNERS_HEIGHT_VAR,
      `${height}px`,
    );
    setBannersHeight(height);
    onHeightChange?.(height);
  }, [onHeightChange, setBannersHeight]);

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
      setBannersHeight(0);
      onHeightChange?.(0);
    };
  }, [publishHeight, onHeightChange, setBannersHeight]);

  return (
    <div
      ref={rootRef}
      className={classes.root}
      data-has-banners={hasBanners || undefined}
      tabIndex={overflowing ? 0 : undefined}
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
