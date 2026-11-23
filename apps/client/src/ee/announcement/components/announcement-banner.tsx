import type { MouseEvent } from "react";
import { ActionIcon, VisuallyHidden } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  ANNOUNCEMENT_COLOR_STYLES,
  ANNOUNCEMENT_TYPE_ICONS,
  ANNOUNCEMENT_TYPE_LABELS,
} from "@/ee/announcement/announcement.constants";
import { getAnnouncementPreview } from "@/ee/announcement/announcement.utils";
import { AnnouncementContent } from "@/ee/announcement/components/announcement-content";
import type { IAnnouncementBanner } from "@/ee/announcement/types/announcement.types";
import classes from "./announcement-banners.module.css";

type AnnouncementBannerProps = {
  announcement: Pick<
    IAnnouncementBanner,
    "type" | "color" | "content" | "isDismissible"
  >;
  onDismiss?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function AnnouncementBanner({
  announcement,
  onDismiss,
}: AnnouncementBannerProps) {
  const { t } = useTranslation();
  // A newer server can send a preset this bundle does not know yet
  const colors =
    ANNOUNCEMENT_COLOR_STYLES[announcement.color] ??
    ANNOUNCEMENT_COLOR_STYLES.gray;
  const TypeIcon = ANNOUNCEMENT_TYPE_ICONS[announcement.type] ?? null;
  const typeLabel = ANNOUNCEMENT_TYPE_LABELS[announcement.type];

  return (
    <div
      className={classes.bar}
      data-dismissible={announcement.isDismissible || undefined}
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      {TypeIcon && <TypeIcon size={18} className={classes.icon} aria-hidden />}
      <div>
        {typeLabel && announcement.type !== "neutral" && (
          // The colon stays out of the key: i18next reads a spaceless "x:" key as a namespace
          <VisuallyHidden>{`${t(typeLabel)}: `}</VisuallyHidden>
        )}
        <AnnouncementContent content={announcement.content} />
      </div>
      {announcement.isDismissible && (
        <span className={classes.close}>
          <ActionIcon
            variant="subtle"
            color={colors.text}
            aria-label={t("Dismiss {{name}}", {
              name: getAnnouncementPreview(announcement.content),
            })}
            onClick={onDismiss}
          >
            <IconX size={16} aria-hidden />
          </ActionIcon>
        </span>
      )}
    </div>
  );
}
