import { List, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { formatAnnouncementTime } from "@/ee/announcement/announcement.utils";
import type { IAnnouncementLimitConflict } from "@/ee/announcement/types/announcement.types";

type AnnouncementConflictSummaryProps = {
  conflict: IAnnouncementLimitConflict;
};

export function AnnouncementConflictSummary({
  conflict,
}: AnnouncementConflictSummaryProps) {
  const { t, i18n } = useTranslation();
  const from = formatAnnouncementTime(conflict.from, i18n.language);

  return (
    <>
      <Text size="sm">
        {conflict.to
          ? t("These already show between {{from}} and {{to}}:", {
              from,
              to: formatAnnouncementTime(conflict.to, i18n.language),
            })
          : t("These already show from {{from}} with no end:", { from })}
      </Text>
      <List size="sm" mt={4}>
        {conflict.announcements.map((clash) => (
          <List.Item key={clash.id}>{clash.title}</List.Item>
        ))}
      </List>
    </>
  );
}
