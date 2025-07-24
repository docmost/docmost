import { Button } from "@mantine/core";
import { IconLogin } from "@tabler/icons-react";
import { useOidcAuth } from "@/features/auth/hooks/use-oidc-auth";
import { useOidcConfigQuery } from "@/features/auth/queries/oidc-query";

interface Props {
  fullWidth?: boolean;
  disabled?: boolean;
}

export function OidcButton({ fullWidth = false, disabled = false }: Props) {
  const { startOidcAuth, isLoading } = useOidcAuth();
  const { data: config } = useOidcConfigQuery();

  const handleClick = () => {
    if (!disabled) {
      startOidcAuth();
    }
  };

  return (
    <Button
      onClick={handleClick}
      fullWidth={fullWidth}
      loading={isLoading}
      disabled={disabled}
      variant="outline"
      leftSection={<IconLogin size={18} />}
    >
      {config?.buttonText || "Sign in with SSO"}
    </Button>
  );
}
