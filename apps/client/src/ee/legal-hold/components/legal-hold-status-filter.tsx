import { Select } from "@mantine/core";
import { useTranslation } from "react-i18next";

type LegalHoldStatusFilterProps = {
  released: boolean;
  onChange: (released: boolean) => void;
};

export function LegalHoldStatusFilter({
  released,
  onChange,
}: LegalHoldStatusFilterProps) {
  const { t } = useTranslation();

  return (
    <Select
      size="sm"
      w={170}
      aria-label={t("Status")}
      data={[
        { value: "active", label: t("Active") },
        { value: "released", label: t("Released") },
      ]}
      value={released ? "released" : "active"}
      onChange={(value) => {
        const next = value === "released";
        if (next !== released) onChange(next);
      }}
      allowDeselect={false}
      checkIconPosition="right"
    />
  );
}
