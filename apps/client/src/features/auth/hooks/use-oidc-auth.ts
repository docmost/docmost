import { useState } from "react";
import { getOidcAuthUrl, getOidcConfig } from "@/features/auth/services/oidc-service";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

export function useOidcAuth() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const startOidcAuth = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const { url } = await getOidcAuthUrl();
      
      if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL received from server');
      }
      
      try {
        new URL(url);
      } catch {
        throw new Error('Invalid URL format');
      }
      
      window.location.href = url;
    } catch (error) {
      setIsLoading(false);
      notifications.show({
        message: t("Failed to start OIDC authentication"),
        color: "red",
      });
    }
  };

  return {
    startOidcAuth,
    isLoading,
  };
}
