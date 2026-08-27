import { Button, Divider } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { GoogleIcon } from "@/components/icons/google-icon.tsx";
import { getRedirectParam } from "@/lib/app-route.ts";

interface GoogleSsoButtonProps {
  workspaceId: string;
  /** Hide the "OR" divider when password login is not shown anyway. */
  showDivider?: boolean;
}

function getServerAppUrl(): string {
  return process.env.APP_URL || window.location.origin;
}

export default function GoogleSsoButton({
  workspaceId,
  showDivider = true,
}: GoogleSsoButtonProps) {
  const { t } = useTranslation();

  const handleLogin = () => {
    const params = new URLSearchParams({ workspaceId });
    const redirect = getRedirectParam();
    if (redirect) {
      params.set("redirect", redirect);
    }

    // Full-page redirect: the server sets an httpOnly cookie on the callback,
    // so there is no token for the client to handle.
    window.location.href = `${getServerAppUrl()}/api/sso/google/login?${params.toString()}`;
  };

  return (
    <>
      <Button
        onClick={handleLogin}
        variant="default"
        fullWidth
        leftSection={<GoogleIcon size={16} />}
      >
        {t("Continue with Google")}
      </Button>

      {showDivider && <Divider my="md" label={t("OR")} labelPosition="center" />}
    </>
  );
}
