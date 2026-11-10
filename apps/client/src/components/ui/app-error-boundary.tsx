import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import { Button } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/ui/empty-state.tsx";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

export function AppErrorBoundary({ children }: AppErrorBoundaryProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <ErrorBoundary
      resetKeys={[pathname]}
      fallback={
        <EmptyState
          icon={IconAlertTriangle}
          title={t("Something went wrong")}
          description={t("This page failed to load. Reload to try again.")}
          action={
            <Button
              variant="default"
              size="sm"
              mt="xs"
              onClick={() => window.location.reload()}
            >
              {t("Reload")}
            </Button>
          }
        />
      }
    >
      {children}
    </ErrorBoundary>
  );
}
