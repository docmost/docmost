import { useEffect, useReducer } from "react";
import { useElementSize, useInterval } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { ANNOUNCEMENT_BANNERS_HEIGHT_VAR } from "@/ee/announcement/announcement.constants";
import {
  dismissAnnouncement,
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
  const { ref, height } = useElementSize();

  useInterval(rerender, 30_000, { autoInvoke: true });

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(ANNOUNCEMENT_BANNERS_HEIGHT_VAR, `${height}px`);
    onHeightChange?.(height);
    return () => {
      root.style.removeProperty(ANNOUNCEMENT_BANNERS_HEIGHT_VAR);
      onHeightChange?.(0);
    };
  }, [height, onHeightChange]);

  const now = Date.now();
  const banners = (data ?? []).filter(
    (announcement) =>
      isAnnouncementVisibleAt(announcement, now) &&
      !(announcement.isDismissible && isAnnouncementDismissed(announcement)),
  );
  const hasBanners = banners.length > 0;

  return (
    <div
      ref={ref}
      className={classes.root}
      role={hasBanners ? "region" : undefined}
      aria-label={hasBanners ? t("Announcements") : undefined}
    >
      {banners.map((announcement) => (
        <AnnouncementBanner
          key={announcement.id}
          announcement={announcement}
          onDismiss={() => {
            dismissAnnouncement(announcement);
            rerender();
          }}
        />
      ))}
    </div>
  );
}
