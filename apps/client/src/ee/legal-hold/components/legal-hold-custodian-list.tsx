import { Badge, Group, Table, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import NoTableResults from "@/components/common/no-table-results";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import type { LegalHoldUserView } from "@/ee/legal-hold/types/legal-hold.types";

type LegalHoldCustodianListProps = {
  custodians: LegalHoldUserView[];
};

export function LegalHoldCustodianList({
  custodians,
}: LegalHoldCustodianListProps) {
  const { t } = useTranslation();

  return (
    <Table.ScrollContainer minWidth={400}>
      <Table verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("Member")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {custodians.length > 0 ? (
            custodians.map((custodian) => (
              <Table.Tr key={custodian.id}>
                <Table.Td>
                  <Group gap="sm" wrap="nowrap">
                    <CustomAvatar
                      avatarUrl={custodian.avatarUrl}
                      name={custodian.name ?? custodian.email}
                    />
                    <div style={{ minWidth: 0 }}>
                      <Group gap="xs" wrap="nowrap">
                        <Text fz="sm" fw={500} lineClamp={1}>
                          {custodian.name ?? custodian.email}
                        </Text>
                        {custodian.deletedAt ? (
                          <Badge size="sm" variant="light" color="gray">
                            {t("Deleted")}
                          </Badge>
                        ) : (
                          custodian.deactivatedAt && (
                            <Badge size="sm" variant="light" color="orange">
                              {t("Deactivated")}
                            </Badge>
                          )
                        )}
                      </Group>
                      <Text fz="xs" c="dimmed" lineClamp={1}>
                        {custodian.email}
                      </Text>
                    </div>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))
          ) : (
            <NoTableResults colSpan={1} text={t("No custodians")} />
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
