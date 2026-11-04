import { useId } from "react";
import { ActionIcon } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  ANNOUNCEMENT_COLOR_STYLES,
  ANNOUNCEMENT_KIND_ICONS,
} from "@/ee/announcement/announcement.constants";
import { AnnouncementContent } from "@/ee/announcement/components/announcement-content";
import type { IAnnouncementBanner } from "@/ee/announcement/types/announcement.types";
import classes from "./announcement-banners.module.css";

type AnnouncementBannerProps = {
  announcement: Pick<
    IAnnouncementBanner,
    "kind" | "color" | "content" | "isDismissible"
  >;
  onDismiss?: () => void;
};

export function AnnouncementBanner({
  announcement,
  onDismiss,
}: AnnouncementBannerProps) {
  const { t } = useTranslation();
  const messageId = useId();
  const colors = ANNOUNCEMENT_COLOR_STYLES[announcement.color];
  const KindIcon = ANNOUNCEMENT_KIND_ICONS[announcement.kind];

  return (
    <div
      className={classes.bar}
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      {KindIcon && <KindIcon size={18} className={classes.icon} aria-hidden />}
      <div id={messageId}>
        <AnnouncementContent content={announcement.content} />
      </div>
      {announcement.isDismissible && (
        <span className={classes.close}>
          <ActionIcon
            variant="subtle"
            color={colors.text}
            aria-label={t("Dismiss announcement")}
            aria-describedby={messageId}
            onClick={onDismiss}
          >
            <IconX size={16} aria-hidden />
          </ActionIcon>
        </span>
      )}
    </div>
  );
}
