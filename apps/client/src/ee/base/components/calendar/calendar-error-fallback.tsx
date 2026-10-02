import { Button } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/ui/empty-state";

export function CalendarErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={IconAlertTriangle}
      title={t("Failed to load calendar")}
      action={
        <Button variant="default" size="sm" mt="xs" onClick={onRetry}>
          {t("Try again")}
        </Button>
      }
    />
  );
}
