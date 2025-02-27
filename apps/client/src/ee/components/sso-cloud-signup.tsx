import { Button, Divider, Stack } from "@mantine/core";
import { getGoogleSignupUrl } from "@/ee/security/sso.utils.ts";
import { GoogleIcon } from "@/components/icons/google-icon.tsx";

export default function SsoCloudSignup() {
  const handleSsoLogin = () => {
    window.location.href = getGoogleSignupUrl();
  };

  return (
    <>
      <Stack align="stretch" justify="center" gap="sm">
        <Button
          onClick={handleSsoLogin}
          leftSection={<GoogleIcon size={16} />}
          variant="default"
          fullWidth
        >
          Signup with Google
        </Button>
      </Stack>
      <Divider my="xs" label="OR" labelPosition="center" />
    </>
  );
}
