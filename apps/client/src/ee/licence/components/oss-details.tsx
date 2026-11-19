import { Group, List, Stack, Table, Text, ThemeIcon } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { UpgradeBadge } from "@/ee/components/upgrade-badge";
import { isBetaBaseForms } from "@/lib/config";

const paidFeatures: { name: string; enterpriseOnly?: boolean }[] = [
  { name: "AI Integration (Chat, Search & Assistant)" },
  { name: "MCP Support" },
  { name: "SSO (SAML, OIDC, LDAP)" },
  { name: "Multi-factor Authentication (2FA)" },
  { name: "Page-level Permissions" },
  { name: "API Keys" },
  { name: "Advanced Search Engine Support" },
  { name: "Full-text Search in Attachments (PDF, DOCX)" },
  { name: "Confluence, PDF & DOCX Import" },
  { name: "Bases, Kanban & Calendar" },
  ...(isBetaBaseForms() ? [{ name: "Forms" }] : []),
  { name: "Templates" },
  { name: "Personal Spaces" },
  { name: "Announcements" },
  { name: "Disable Public Sharing" },
  { name: "Jira & GitLab Integrations" },
  { name: "SCIM Provisioning", enterpriseOnly: true },
  { name: "Page Verification & Approval Workflow", enterpriseOnly: true },
  { name: "Audit Logs & SIEM", enterpriseOnly: true },
  { name: "Security, Export & Retention Controls", enterpriseOnly: true },
  { name: "SharePoint & Azure DevOps Integrations", enterpriseOnly: true },
  { name: "Read Confirmation*", enterpriseOnly: true },
  { name: "Advanced Confluence Migration", enterpriseOnly: true },
];

export default function OssDetails() {
  return (
    <Stack gap="lg">
      <Table.ScrollContainer minWidth={500} py="md">
        <Table
          variant="vertical"
          verticalSpacing="sm"
          layout="fixed"
          withTableBorder
        >
          <Table.Tbody>
            <Table.Tr>
              <Table.Th w={160}>Edition</Table.Th>
              <Table.Td>
                <Group wrap="nowrap">
                  Open Source
                  <div>
                    <ThemeIcon
                      color="green"
                      variant="light"
                      size={24}
                      radius="xl"
                    >
                      <IconCheck size={16} />
                    </ThemeIcon>
                  </div>
                </Group>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Stack gap="md">
        <Text fw={500}>Upgrade to Business or Enterprise to unlock:</Text>

        <List
          size="sm"
          icon={
            <ThemeIcon size={20} color={"gray"} radius="xl">
              <IconCheck size={14} />
            </ThemeIcon>
          }
          style={{ columns: "2 16rem", columnGap: "var(--mantine-spacing-xl)" }}
          styles={{ item: { breakInside: "avoid", paddingBlock: 2 } }}
        >
          {paidFeatures.map((feature) => (
            <List.Item key={feature.name}>
              {feature.name}
              {feature.enterpriseOnly && (
                <UpgradeBadge label="Enterprise" ml="xs" />
              )}
            </List.Item>
          ))}
        </List>

        <Text size="sm" c="dimmed">
          Start a free Business or Enterprise trial at{" "}
          <a
            href="https://customers.docmost.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            customers.docmost.com
          </a>
          .
        </Text>

        <Text size="sm" c="dimmed">
          Compare editions at{" "}
          <a
            href="https://docmost.com/pricing"
            target="_blank"
            rel="noopener noreferrer"
          >
            docmost.com/pricing
          </a>
          , or contact <a href="mailto:sales@docmost.com">sales@docmost.com</a>.
        </Text>
      </Stack>
    </Stack>
  );
}
