import { Select } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { SpaceListStatus } from "@/features/space/types/space.types.ts";

interface SpaceStatusFilterProps {
  status: SpaceListStatus;
  onChange: (status: SpaceListStatus) => void;
}

export default function SpaceStatusFilter({
  status,
  onChange,
}: SpaceStatusFilterProps) {
  const { t } = useTranslation();

  return (
    <Select
      size="sm"
      w={170}
      aria-label={t("Status")}
      data={[
        { value: "active", label: t("Active spaces") },
        { value: "archived", label: t("Archived spaces") },
        { value: "all", label: t("All spaces") },
      ]}
      value={status}
      onChange={(value) => {
        if (value && value !== status) onChange(value as SpaceListStatus);
      }}
      allowDeselect={false}
      checkIconPosition="right"
    />
  );
}
