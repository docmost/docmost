import { useParams } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import { Button } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import AiChatLayout from "../components/ai-chat-layout";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import classes from "../styles/ai-chat.module.css";

export default function AiChat() {
  const { t } = useTranslation();
  const { chatId } = useParams<{ chatId: string }>();

  return (
    <div className={classes.layout}>
      <ErrorBoundary
        resetKeys={[chatId]}
        fallbackRender={({ resetErrorBoundary }) => (
          <EmptyState
            icon={IconAlertTriangle}
            title={t("Failed to load chat. An error occurred.")}
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
        <AiChatLayout />
      </ErrorBoundary>
    </div>
  );
}
