import React, { useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import { Button, Menu, Group } from "@mantine/core";
import { IconChevronDown, IconLock, IconServer } from "@tabler/icons-react";
import { useCreateSsoProviderMutation } from "@/ee/security/queries/security-query.ts";
import { SSO_PROVIDER } from "@/ee/security/contants.ts";
import { IAuthProvider } from "@/ee/security/types/security.types.ts";
import SsoProviderModal from "@/ee/security/components/sso-provider-modal.tsx";
import { OpenIdIcon } from "@/components/icons/openid-icon.tsx";

export default function CreateSsoProvider() {
  const [opened, { open, close }] = useDisclosure(false);
  const [provider, setProvider] = useState<IAuthProvider | null>(null);

  const createSsoProviderMutation = useCreateSsoProviderMutation();

  const handleCreateSAML = async () => {
    try {
      const newProvider = await createSsoProviderMutation.mutateAsync({
        type: SSO_PROVIDER.SAML,
        name: "SAML",
      });
      setProvider(newProvider);
      open();
    } catch (error) {
      console.error("Failed to create SAML provider", error);
    }
  };

  const handleCreateOIDC = async () => {
    try {
      const newProvider = await createSsoProviderMutation.mutateAsync({
        type: SSO_PROVIDER.OIDC,
        name: "OIDC",
      });
      setProvider(newProvider);
      open();
    } catch (error) {
      console.error("Failed to create OIDC provider", error);
    }
  };

  const handleCreateLDAP = async () => {
    try {
      const newProvider = await createSsoProviderMutation.mutateAsync({
        type: SSO_PROVIDER.LDAP,
        name: "LDAP",
      });
      setProvider(newProvider);
      open();
    } catch (error) {
      console.error("Failed to create LDAP provider", error);
    }
  };

  return (
    <>
      <SsoProviderModal opened={opened} onClose={close} provider={provider} />

      <Group justify="flex-end">
        <Menu
          transitionProps={{ transition: "pop-top-right" }}
          position="bottom"
          width={220}
          withinPortal
        >
          <Menu.Target>
            <Button rightSection={<IconChevronDown size={16} />} pr={12}>
              Create SSO
            </Button>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item
              onClick={handleCreateSAML}
              leftSection={<IconLock size={16} />}
            >
              SAML
            </Menu.Item>

            <Menu.Item
              onClick={handleCreateOIDC}
              leftSection={<OpenIdIcon size={16} />}
            >
              OpenID (OIDC)
            </Menu.Item>

            <Menu.Item
              onClick={handleCreateLDAP}
              leftSection={<IconServer size={16} />}
            >
              LDAP / Active Directory
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </>
  );
}
