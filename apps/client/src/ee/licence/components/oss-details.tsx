import { Group, List, Stack, Table, Text, ThemeIcon } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";

const enterpriseFeatures = [
  "SSO (SAML, OIDC, LDAP)",
  "AI Integration (Search & Assistant)",
  "Page-level Permissions",
  "Audit Logs",
  "API Keys",
  "MCP Support",
  "Multi-factor Authentication (2FA)",
  "Enterprise Controls",
  "Advanced Search Engine Support",
  "Full-text Search in Attachments (PDF, DOCX)",
  "Resolve Comments",
  "Confluence Import",
  "DOCX Import",
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
        <Text fw={500}>Upgrade to the Enterprise Edition to unlock:</Text>

        <List
          spacing={4}
          size="sm"
          icon={
            <ThemeIcon size={20} color={"gray"} radius="xl">
              <IconCheck size={14} />
            </ThemeIcon>
          }
        >
          {enterpriseFeatures.map((feature) => (
            <List.Item key={feature}>{feature}</List.Item>
          ))}
        </List>

        <Text size="sm" c="dimmed">
          Get an enterprise trial key at <a href="https://customers.docmost.com/" target="_blank" rel="noopener noreferrer">customers.docmost.com</a>.
        </Text>

        <Text size="sm" c="dimmed">
          Visit <a href="https://docmost.com/pricing" target="_blank" rel="noopener noreferrer">docmost.com/pricing</a> to purchase an enterprise license.
        </Text>
      </Stack>
    </Stack>
  );
}
