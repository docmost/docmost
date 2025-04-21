import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query.ts";
import { Button, Divider, Stack } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { IAuthProvider } from "@/ee/security/types/security.types.ts";
import { buildSsoLoginUrl } from "@/ee/security/sso.utils.ts";
import { SSO_PROVIDER } from "@/ee/security/contants.ts";
import { GoogleIcon } from "@/components/icons/google-icon.tsx";
import { isCloud } from "@/lib/config.ts";

export default function SsoLogin() {
  const { data, isLoading } = useWorkspacePublicDataQuery();

  if (!data?.authProviders || data?.authProviders?.length === 0) {
    return null;
  }

  const handleSsoLogin = (provider: IAuthProvider) => {
    window.location.href = buildSsoLoginUrl({
      providerId: provider.id,
      type: provider.type,
      workspaceId: data.id,
    });
  };

  return (
    <>
      {(isCloud() || data.hasLicenseKey) && (
        <>
          <Stack align="stretch" justify="center" gap="sm">
            {data.authProviders.map((provider) => (
              <div key={provider.id}>
                <Button
                  onClick={() => handleSsoLogin(provider)}
                  leftSection={
                    provider.type === SSO_PROVIDER.GOOGLE ? (
                      <GoogleIcon size={16} />
                    ) : (
                      <IconLock size={16} />
                    )
                  }
                  variant="default"
                  fullWidth
                >
                  {provider.name}
                </Button>
              </div>
            ))}
          </Stack>

          {!data.enforceSso && (
            <Divider my="xs" label="OR" labelPosition="center" />
          )}
        </>
      )}
    </>
  );
}
