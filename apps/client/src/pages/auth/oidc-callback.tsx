import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Container, Text, Loader, Stack } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import APP_ROUTE from "@/lib/app-route";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import api from "@/lib/api-client";

export default function OidcCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        notifications.show({
          message: t("OIDC authentication failed: ") + error,
          color: "red",
        });
        navigate(APP_ROUTE.AUTH.LOGIN);
        return;
      }

      if (!code || !state) {
        notifications.show({
          message: t("Invalid OIDC callback parameters"),
          color: "red",
        });
        navigate(APP_ROUTE.AUTH.LOGIN);
        return;
      }

      if (code.length < 10 || code.length > 1000) {
        notifications.show({
          message: t("Invalid authentication code"),
          color: "red",
        });
        navigate(APP_ROUTE.AUTH.LOGIN);
        return;
      }

      if (state.length < 10 || state.length > 255) {
        notifications.show({
          message: t("Invalid state parameter"),
          color: "red",
        });
        navigate(APP_ROUTE.AUTH.LOGIN);
        return;
      }

      try {
        const response = await api.post("/auth/oidc/callback", {
          code, 
          state,
        });

        if (response.data.success) {
          try {
            const userResponse = await api.get("/auth/me");
            setCurrentUser(userResponse.data);
          } catch (error) {
            setCurrentUser(null);
          }

          notifications.show({
            message: t("OIDC authentication successful"),
            color: "green",
          });

        navigate(APP_ROUTE.HOME);
        } else {
          throw new Error("Authentication failed");
        }
      } catch (error) {
        notifications.show({
          message: t("OIDC authentication failed"),
          color: "red",
        });
        navigate(APP_ROUTE.AUTH.LOGIN);
      }
    };

    handleCallback();
  }, [searchParams, navigate, t, setCurrentUser]);

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="md">
        <Loader size="lg" />
        <Text size="lg" ta="center">
          {t("Processing authentication...")}
        </Text>
      </Stack>
    </Container>
  );
}
