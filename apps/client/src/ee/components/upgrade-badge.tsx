import { Badge, type BadgeProps } from "@mantine/core";
import { useTranslation } from "react-i18next";

type UpgradeBadgeProps = {
  label?: string;
} & Pick<BadgeProps, "mt" | "ml">;

export function UpgradeBadge({ label, mt, ml }: UpgradeBadgeProps) {
  const { t } = useTranslation();

  return (
    <Badge color="gray" variant="light" size="sm" radius="sm" mt={mt} ml={ml}>
      {label ?? t("Upgrade")}
    </Badge>
  );
}
