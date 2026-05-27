import { Badge } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { CrStatus } from "../types/cr.types";

const STATUS_COLORS: Record<CrStatus, string> = {
  IN_REVIEW: 'blue',
  IN_VERIFICATION: 'violet',
  IN_PROGRESS: 'orange',
  PUBLISHED: 'green',
  CLOSED: 'dark',
};

interface CRStateBadgeProps {
  status: CrStatus;
  size?: "xs" | "sm" | "md" | "lg";
}

export function CRStateBadge({ status, size = "sm" }: CRStateBadgeProps) {
  const { t } = useTranslation();
  return (
    <Badge color={STATUS_COLORS[status]} variant="light" size={size}>
      {t(status)}
    </Badge>
  );
}
