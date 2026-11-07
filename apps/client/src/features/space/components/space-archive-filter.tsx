import { Select } from "@mantine/core";
import { useTranslation } from "react-i18next";

interface SpaceArchiveFilterProps {
  archived: boolean;
  onChange: (archived: boolean) => void;
}

export default function SpaceArchiveFilter({
  archived,
  onChange,
}: SpaceArchiveFilterProps) {
  const { t } = useTranslation();

  return (
    <Select
      size="sm"
      w={170}
      aria-label={t("Status")}
      data={[
        { value: "active", label: t("Active spaces") },
        { value: "archived", label: t("Archived spaces") },
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
