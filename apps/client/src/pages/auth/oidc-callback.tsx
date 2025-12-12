import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Container, Text, Loader, Stack } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import APP_ROUTE from "@/lib/app-route";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import api from "@/lib/api-client";

const CODE_PATTERN = /^[A-Za-z0-9._~+-]+$/;
const STATE_PATTERN = /^[A-Za-z0-9._~-]+$/;

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
      const iss = searchParams.get("iss");
      const error = searchParams.get("error");

      if (error) {
        notifications.show({
          message: t("Authentication failed. Please try again!"),
          color: "red",
        });
        navigate(APP_ROUTE.AUTH.LOGIN);
        return;
      }

      // Validates that required parameters exist.
      if (!code || !state) {
        notifications.show({
          message: t("Invalid callback parameters"),
          color: "red",
        });
        navigate(APP_ROUTE.AUTH.LOGIN);
        return;
      }

      if (code.length < 10 || code.length > 2048 || !CODE_PATTERN.test(code)) {
        notifications.show({
          message: t("Invalid authentication request"),
          color: "red",
        });
        navigate(APP_ROUTE.AUTH.LOGIN);
        return;
      }

      if (state.length < 20 || state.length > 512 || !STATE_PATTERN.test(state)) {
        notifications.show({
          message: t("Invalid authentication request"),
          color: "red",
        });
        navigate(APP_ROUTE.AUTH.LOGIN);
        return;
      }

      if (iss) {
        try {
          const issuerUrl = new URL(iss);
          if (issuerUrl.protocol !== "https:" && issuerUrl.protocol !== "http:") {
            throw new Error("Invalid issuer protocol");
          }
        } catch {
          notifications.show({
            message: t("Invalid authentication request"),
            color: "red",
          });
          navigate(APP_ROUTE.AUTH.LOGIN);
          return;
        }
      }

      try {
        const response = await api.post("/auth/oidc/callback", {
          code,
          state,
          iss: iss || undefined, // Some older IdP might not include the issuer in the callback.
        });

        if (response.data.success) {
          try {
            const userResponse = await api.get("/auth/me");
            setCurrentUser(userResponse.data);
          } catch {
            setCurrentUser(null);
          }

          notifications.show({
            message: t("Successfully signed in."),
            color: "green",
          });

          navigate(APP_ROUTE.HOME);
        } else {
          throw new Error("Authentication failed");
        }
      } catch {
        notifications.show({
          message: t("Authentication failed. Please try again!"),
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
