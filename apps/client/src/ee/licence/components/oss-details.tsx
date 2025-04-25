import { Group, Table, ThemeIcon } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export default function OssDetails() {
  const { t } = useTranslation();
  return (
    <Table.ScrollContainer minWidth={500} py="md">
      <Table
        variant="vertical"
        verticalSpacing="sm"
        layout="fixed"
        withTableBorder
      >
        <Table.Caption>
          {t('To unlock enterprise features like SSO, contact sales@docmost.com.')}
        </Table.Caption>
        <Table.Tbody>
          <Table.Tr>
            <Table.Th w={160}>{t('Edition')}</Table.Th>
            <Table.Td>
              <Group wrap="nowrap">
                {t('Open Source')}
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
