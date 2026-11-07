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

  const date = formatLocalized(space.archivedAt, "MMM dd, yyyy", "PP", locale);

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
          {space.archivedBy?.name
            ? t("Archived by {{name}} on {{date}}.", {
                name: space.archivedBy.name,
                date,
              })
            : t("Archived on {{date}}.", { date })}
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
            {t("Restore space")}
          </Button>
        )}
      </Group>
    </Alert>
  );
}
