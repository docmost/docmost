import { Alert, Button, Group, Text } from "@mantine/core";
import { IconArchive } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";
import { useUnarchiveSpaceMutation } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale.ts";

type SpaceArchivedNoticeProps = {
  space: ISpace;
};

export default function SpaceArchivedNotice({
  space,
}: SpaceArchivedNoticeProps) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const spaceAbility = useSpaceAbility(space?.membership?.permissions);
  const unarchiveSpaceMutation = useUnarchiveSpaceMutation();

  if (!space?.archivedAt) {
    return null;
  }

  return (
    <Alert
      variant="light"
      color="gray"
      icon={<IconArchive size={18} />}
      role="note"
      title={t("This space is archived")}
      mb="lg"
    >
      <Group justify="space-between" gap="xs">
        <Text size="sm">
          {t(
            "Archived on {{date}}. It is hidden from the space list, search outside this space, AI answers and connected AI apps.",
            {
              date: formatLocalized(
                space.archivedAt,
                "MMM dd, yyyy",
                "PP",
                locale,
              ),
            },
          )}
        </Text>
        {spaceAbility.can(
          SpaceCaslAction.Manage,
          SpaceCaslSubject.Settings,
        ) && (
          <Button
            size="xs"
            variant="default"
            onClick={() => unarchiveSpaceMutation.mutate(space.id)}
            loading={unarchiveSpaceMutation.isPending}
          >
            {t("Unarchive")}
          </Button>
        )}
      </Group>
    </Alert>
  );
}
