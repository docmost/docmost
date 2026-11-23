import { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Button } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/ui/empty-state.tsx";

type CommentErrorBoundaryProps = {
  children: ReactNode;
};

// Contain comment-editor render throws (e.g. schema errors) so they don't unmount the whole app.
export function CommentErrorBoundary({ children }: CommentErrorBoundaryProps) {
  const { t } = useTranslation();

  return (
    <ErrorBoundary
      fallbackRender={({ resetErrorBoundary }) => (
        <EmptyState
          icon={IconAlertTriangle}
          title={t("Failed to load comments. An error occurred.")}
          action={
            <Button
              variant="default"
              size="sm"
              mt="xs"
              onClick={resetErrorBoundary}
            >
              {t("Try again")}
            </Button>
          }
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
