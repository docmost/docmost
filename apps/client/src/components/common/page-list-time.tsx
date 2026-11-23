import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatFullDateTime, shortTimeAgo } from "@/lib/time";

type PageListTimeProps = {
  value?: string | Date;
  field?: "createdAt" | "updatedAt";
  className?: string;
  children?: ReactNode;
};

export function PageListTime({
  value,
  field = "updatedAt",
  className,
  children,
}: PageListTimeProps) {
  const { t } = useTranslation();
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  const timestamp = formatFullDateTime(date);
  const title =
    field === "createdAt"
      ? t("Created at {{timestamp}}", { timestamp })
      : t("Updated at {{timestamp}}", { timestamp });
  return (
    <time
      className={className}
      dateTime={typeof value === "string" ? value : date.toISOString()}
      title={title}
    >
      {children ?? shortTimeAgo(date)}
    </time>
  );
}
