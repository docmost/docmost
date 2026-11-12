import { Badge, Group, Table, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import NoTableResults from "@/components/common/no-table-results";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";
import type { LegalHoldSpaceView } from "@/ee/legal-hold/types/legal-hold.types";

type LegalHoldSpaceListProps = {
  spaces: LegalHoldSpaceView[];
};

export function LegalHoldSpaceList({ spaces }: LegalHoldSpaceListProps) {
  const { t } = useTranslation();

  return (
    <Table.ScrollContainer minWidth={400}>
      <Table verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("Space")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {spaces.length > 0 ? (
            spaces.map((space) => {
              const name = space.name || space.slug || t("Untitled");
              return (
                <Table.Tr key={space.id}>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <CustomAvatar
                        color="initials"
                        variant="filled"
                        type={AvatarIconType.SPACE_ICON}
                        avatarUrl={space.logo}
                        name={name}
                      />
                      <Text fz="sm" fw={500} lineClamp={1}>
                        {name}
                      </Text>
                      {space.deleted ? (
                        <Badge size="sm" variant="light" color="gray">
                          {t("Deleted space")}
                        </Badge>
                      ) : (
                        space.archivedAt && (
                          <Badge size="sm" variant="light" color="gray">
                            {t("Archived")}
                          </Badge>
                        )
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })
          ) : (
            <NoTableResults colSpan={1} text={t("No spaces")} />
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
