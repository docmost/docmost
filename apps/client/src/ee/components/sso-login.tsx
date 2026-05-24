import { useEffect, useRef, useState } from "react";
import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query.ts";
import { Button, Divider, Stack } from "@mantine/core";
import { IconLock, IconServer } from "@tabler/icons-react";
import { IAuthProvider } from "@/ee/security/types/security.types.ts";
import { buildSsoLoginUrl } from "@/ee/security/sso.utils.ts";
import { SSO_PROVIDER } from "@/ee/security/contants.ts";
import { GoogleIcon } from "@/components/icons/google-icon.tsx";
import { LdapLoginModal } from "@/ee/components/ldap-login-modal.tsx";
import { getRedirectParam } from "@/lib/app-route.ts";
import useCurrentUser from "@/features/user/hooks/use-current-user.ts";

const SSO_AUTO_ATTEMPT_KEY = "docmost:ssoAutoAttempt";
const SSO_AUTO_ATTEMPT_TTL_MS = 5 * 60_000;

function recentAutoAttempt(): boolean {
  try {
    const raw = window.sessionStorage.getItem(SSO_AUTO_ATTEMPT_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < SSO_AUTO_ATTEMPT_TTL_MS;
  } catch {
    return false;
  }
}

function markAutoAttempt(): void {
  try {
    window.sessionStorage.setItem(SSO_AUTO_ATTEMPT_KEY, String(Date.now()));
  } catch {
    /* sessionStorage unavailable (private mode, etc.) — best effort */
  }
}

export default function SsoLogin() {
  const { data, isLoading } = useWorkspacePublicDataQuery();
  const { data: currentUser } = useCurrentUser();
  const [ldapModalOpened, setLdapModalOpened] = useState(false);
  const [selectedLdapProvider, setSelectedLdapProvider] = useState<IAuthProvider | null>(null);
  const autoRedirectedRef = useRef(false);

  const handleSsoLogin = (provider: IAuthProvider) => {
    if (provider.type === SSO_PROVIDER.LDAP) {
      // Open modal for LDAP instead of redirecting
      setSelectedLdapProvider(provider);
      setLdapModalOpened(true);
    } else {
      // Redirect for other SSO providers
      window.location.href = buildSsoLoginUrl({
        providerId: provider.id,
        type: provider.type,
        workspaceId: data.id,
        redirect: getRedirectParam() ?? undefined,
      });
    }
  };

  // Auto-redirect when SSO is enforced and there is exactly one non-LDAP
  // provider. The user has no other option, so skip the extra click.
  useEffect(() => {
    if (autoRedirectedRef.current) return;
    if (!data?.enforceSso) return;
    if (!data.authProviders || data.authProviders.length !== 1) return;
    const onlyProvider = data.authProviders[0];
    if (onlyProvider.type === SSO_PROVIDER.LDAP) return;

    // Already signed in: let useRedirectIfAuthenticated handle navigation
    // instead of racing it through the IdP.
    if (currentUser?.user) return;

    // Explicit logout: don't immediately bounce them back to the IdP.
    const params = new URLSearchParams(window.location.search);
    if (params.has("logout")) return;

    // Circuit-breaker: if we already auto-redirected within the TTL, the
    // user came back (likely from an IdP failure). Show the page so they
    // can read errors or pick a different account.
    if (recentAutoAttempt()) return;

    autoRedirectedRef.current = true;
    markAutoAttempt();
    window.location.href = buildSsoLoginUrl({
      providerId: onlyProvider.id,
      type: onlyProvider.type,
      workspaceId: data.id,
      redirect: getRedirectParam() ?? undefined,
    });
  }, [data, currentUser]);

  if (!data?.authProviders || data?.authProviders?.length === 0) {
    return null;
  }

  const getProviderIcon = (provider: IAuthProvider) => {
    if (provider.type === SSO_PROVIDER.GOOGLE) {
      return <GoogleIcon size={16} />;
    } else if (provider.type === SSO_PROVIDER.LDAP) {
      return <IconServer size={16} />;
    } else {
      return <IconLock size={16} />;
    }
  };

  return (
    <>
      {selectedLdapProvider && (
        <LdapLoginModal
          opened={ldapModalOpened}
          onClose={() => {
            setLdapModalOpened(false);
            setSelectedLdapProvider(null);
          }}
          provider={selectedLdapProvider}
          workspaceId={data.id}
        />
      )}

      {data.authProviders.length > 0 && (
        <>
          <Stack align="stretch" justify="center" gap="sm">
            {data.authProviders.map((provider) => (
              <div key={provider.id}>
                <Button
                  onClick={() => handleSsoLogin(provider)}
                  leftSection={getProviderIcon(provider)}
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
