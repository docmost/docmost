import { Button, Group, Text, Modal, TextInput, Alert, Code, Stack, Table } from "@mantine/core";
import * as z from "zod";
import { useState, useMemo } from "react";
import { useDisclosure } from "@mantine/hooks";
import * as React from "react";
import { useForm, zodResolver } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { addCustomDomain, removeCustomDomain, verifyDnsConfiguration } from "@/features/workspace/services/workspace-service.ts";
import { useAtom } from "jotai/index";
import {
  currentUserAtom,
  workspaceAtom,
} from "@/features/user/atoms/current-user-atom.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { RESET } from "jotai/utils";
import { IconAlertCircle, IconCheck, IconX } from "@tabler/icons-react";

export default function ManageCustomDomain() {
  const { t } = useTranslation();
  const [customDomainOpened, { open: openCustomDomain, close: closeCustomDomain }] = useDisclosure(false);
  const [workspace] = useAtom(workspaceAtom);
  const { isAdmin } = useUserRole();

  return (
    <Stack gap="md">
      {workspace?.customDomain && (
        <Group justify="space-between" wrap="nowrap" gap="xl">
          <div>
            <Text size="md">{t("Custom Domain")}</Text>
            <Text size="sm" c="dimmed" fw={500}>
              {workspace.customDomain}
            </Text>
          </div>

          {isAdmin && (
            <Button onClick={openCustomDomain} variant="default" color="red">
              {t("Remove custom domain")}
            </Button>
          )}
        </Group>
      )}

      {!workspace?.customDomain && isAdmin && (
        <Group justify="space-between" wrap="nowrap" gap="xl">
          <div>
            <Text size="md">{t("Custom Domain")}</Text>
            <Text size="sm" c="dimmed">
              {t("Add a custom domain to your workspace")}
            </Text>
          </div>

          <Button onClick={openCustomDomain} variant="default">
            {t("Add custom domain")}
          </Button>
        </Group>
      )}

      <Modal
        opened={customDomainOpened}
        onClose={closeCustomDomain}
        title={workspace?.customDomain ? t("Remove custom domain") : t("Add custom domain")}
        centered
        size="lg"
      >
        {workspace?.customDomain ? (
          <RemoveCustomDomainForm onClose={closeCustomDomain} />
        ) : (
          <AddCustomDomainForm onClose={closeCustomDomain} />
        )}
      </Modal>
    </Stack>
  );
}

interface AddCustomDomainFormProps {
  onClose: () => void;
}

const customDomainSchema = z.object({
  domain: z.string().min(1, { message: "Domain is required" }).regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/, {
    message: "Please enter a valid domain (e.g., example.com)"
  }),
});

type CustomDomainFormValues = z.infer<typeof customDomainSchema>;

function AddCustomDomainForm({ onClose }: AddCustomDomainFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    message: string;
    isSubdomain: boolean;
  } | null>(null);
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);

  const form = useForm<CustomDomainFormValues>({
    validate: zodResolver(customDomainSchema),
    initialValues: {
      domain: "",
    },
  });

  // Memoize table content to prevent unnecessary re-renders
  const tableContent = useMemo(() => {
    const isSubdomain = verificationResult?.isSubdomain;
    
    return (
      <Table striped withTableBorder withColumnBorders mt="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Record Type</Table.Th>
            <Table.Th>Host</Table.Th>
            <Table.Th>Value</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isSubdomain ? (
            <Table.Tr>
              <Table.Td>CNAME</Table.Td>
              <Table.Td>{form.values.domain}</Table.Td>
              <Table.Td>app.docmost.com</Table.Td>
            </Table.Tr>
          ) : (
            <>
              <Table.Tr>
                <Table.Td>CNAME</Table.Td>
                <Table.Td>www.{form.values.domain}</Table.Td>
                <Table.Td>app.docmost.com</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>A</Table.Td>
                <Table.Td>{form.values.domain}</Table.Td>
                <Table.Td>YOUR_APP_IP</Table.Td>
              </Table.Tr>
            </>
          )}
        </Table.Tbody>
      </Table>
    );
  }, [verificationResult?.isSubdomain, form.values.domain]);

  async function handleVerifyDns() {
    const domain = form.values.domain;
    if (!domain) return;

    setIsVerifying(true);
    // Don't reset verification result immediately to prevent flicker
    // Only reset if we're starting a new verification

    try {
      const result = await verifyDnsConfiguration({ domain });
      setVerificationResult({
        isValid: result.isValid,
        message: result.message,
        isSubdomain: result.isSubdomain,
      });
    } catch (err) {
      setVerificationResult({
        isValid: false,
        message: err?.response?.data?.message || "Failed to verify DNS configuration",
        isSubdomain: false,
      });
    }
    setIsVerifying(false);
  }

  async function handleSubmit(data: CustomDomainFormValues) {
    setIsLoading(true);

    try {
      await addCustomDomain({ domain: data.domain });
      setCurrentUser(RESET);
      notifications.show({
        message: "Custom domain added successfully! Redirecting...",
        color: "green",
        icon: <IconCheck size={16} />,
      });
      
      // Redirect to the new custom domain
      setTimeout(() => {
        window.location.href = `https://${data.domain}`;
      }, 2000);
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || "Failed to add custom domain",
        color: "red",
        icon: <IconX size={16} />,
      });
    }
    setIsLoading(false);
  }

  const isSubdomain = verificationResult?.isSubdomain;
  const isValid = verificationResult?.isValid;

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <TextInput
          type="text"
          placeholder="example.com"
          label="Custom Domain"
          variant="filled"
          description="Enter your domain (e.g., example.com or subdomain.example.com)"
          {...form.getInputProps("domain")}
        />

        <Alert icon={<IconAlertCircle size={16} />} title="DNS Configuration Required" color="blue">
          <Text size="sm" mb="xs">
            Before adding your custom domain, you need to configure your DNS settings:
          </Text>
          
          {tableContent}
        </Alert>

        <Button 
          type="button" 
          variant="outline" 
          onClick={handleVerifyDns}
          loading={isVerifying}
          disabled={!form.values.domain || !!form.errors.domain}
        >
          {t("Verify DNS Configuration")}
        </Button>

        {verificationResult && (
          <Alert 
            icon={isValid ? <IconCheck size={16} /> : <IconX size={16} />}
            title={isValid ? "DNS Configuration Valid" : "DNS Configuration Invalid"}
            color={isValid ? "green" : "red"}
          >
            <Text size="sm">{verificationResult.message}</Text>
          </Alert>
        )}

        <Group justify="flex-end" mt="md">
          <Button 
            type="submit" 
            disabled={isLoading || !isValid} 
            loading={isLoading}
          >
            {t("Add Custom Domain")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

interface RemoveCustomDomainFormProps {
  onClose: () => void;
}

function RemoveCustomDomainForm({ onClose }: RemoveCustomDomainFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);

  async function handleRemove() {
    if (!currentUser?.workspace?.customDomain) return;

    setIsLoading(true);

    try {
      await removeCustomDomain({ domain: currentUser.workspace.customDomain });
      setCurrentUser(RESET);
      notifications.show({
        message: "Custom domain removed successfully!",
        color: "green",
        icon: <IconCheck size={16} />,
      });
      onClose();
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || "Failed to remove custom domain",
        color: "red",
        icon: <IconX size={16} />,
      });
    }
    setIsLoading(false);
  }

  return (
    <Stack gap="md">
      <Alert icon={<IconAlertCircle size={16} />} title="Remove Custom Domain" color="red">
        <Text size="sm">
          Are you sure you want to remove the custom domain <Code>{currentUser?.workspace?.customDomain}</Code>? 
          This action cannot be undone.
        </Text>
      </Alert>

      <Group justify="flex-end">
        <Button variant="outline" onClick={onClose}>
          {t("Cancel")}
        </Button>
        <Button 
          color="red" 
          onClick={handleRemove}
          disabled={isLoading} 
          loading={isLoading}
        >
          {t("Remove Custom Domain")}
        </Button>
      </Group>
    </Stack>
  );
} 