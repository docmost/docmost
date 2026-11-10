import { Select } from "@mantine/core";
import { useTranslation } from "react-i18next";

type AnnouncementArchiveFilterProps = {
  archived: boolean;
  onChange: (archived: boolean) => void;
};

export function AnnouncementArchiveFilter({
  archived,
  onChange,
}: AnnouncementArchiveFilterProps) {
  const { t } = useTranslation();

  return (
    <Select
      size="sm"
      w={170}
      aria-label={t("Status")}
      data={[
        { value: "active", label: t("Active") },
        { value: "archived", label: t("Archived") },
      ]}
      value={archived ? "archived" : "active"}
      onChange={(value) => {
        const next = value === "archived";
        if (next !== archived) onChange(next);
      }}
      allowDeselect={false}
      checkIconPosition="right"
    />
  );
}
