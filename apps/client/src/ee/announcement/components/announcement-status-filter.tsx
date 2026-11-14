import { Select } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { AnnouncementListStatus } from "@/ee/announcement/types/announcement.types";

type AnnouncementStatusFilterProps = {
  status: AnnouncementListStatus;
  onChange: (status: AnnouncementListStatus) => void;
};

export function AnnouncementStatusFilter({
  status,
  onChange,
}: AnnouncementStatusFilterProps) {
  const { t } = useTranslation();

  return (
    <Select
      size="sm"
      w={170}
      aria-label={t("Status")}
      data={[
        { value: "active", label: t("Active") },
        { value: "archived", label: t("Archived") },
        { value: "all", label: t("All") },
      ]}
      value={status}
      onChange={(value) => {
        if (value && value !== status) {
          onChange(value as AnnouncementListStatus);
        }
      }}
      allowDeselect={false}
      checkIconPosition="right"
    />
  );
}
