import { Select } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { MemberListStatus } from "@/features/workspace/types/workspace.types.ts";

type MemberStatusFilterProps = {
  status: MemberListStatus;
  onChange: (status: MemberListStatus) => void;
};

export default function MemberStatusFilter({
  status,
  onChange,
}: MemberStatusFilterProps) {
  const { t } = useTranslation();

  return (
    <Select
      size="sm"
      w={170}
      aria-label={t("Status")}
      data={[
        { value: "active", label: t("Active") },
        { value: "deactivated", label: t("Deactivated") },
        { value: "deleted", label: t("Deleted") },
        { value: "all", label: t("All") },
      ]}
      value={status}
      onChange={(value) => {
        if (value && value !== status) onChange(value as MemberListStatus);
      }}
      allowDeselect={false}
      checkIconPosition="right"
    />
  );
}
