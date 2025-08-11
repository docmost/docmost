import { Group, Table, ThemeIcon } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";

export default function OssDetails() {
  return (
    <Table.ScrollContainer minWidth={500} py="md">
      <Table
        variant="vertical"
        verticalSpacing="sm"
        layout="fixed"
        withTableBorder
      >
        <Table.Caption>
          To unlock enterprise features like SSO, MFA, Resolve comments, contact sales@docmost.com.
        </Table.Caption>
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
  );
}
