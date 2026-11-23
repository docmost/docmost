import { Button, Group, Paper, Text } from "@mantine/core";
import { IconArchive } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { ISpace } from "@/features/space/types/space.types.ts";
import { useUnarchiveSpaceMutation } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale.ts";
import classes from "./space-archived-notice.module.css";

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

  const date = formatLocalized(space.archivedAt, "MMM d, yyyy", "PP", locale);

  return (
    <Paper
      className={clsx("print-hide", classes.notice)}
      role="note"
      withBorder
      radius="md"
      mb="lg"
      px="md"
      py="xs"
    >
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <IconArchive size={18} aria-hidden style={{ flexShrink: 0 }} />
          <Text size="sm">
            <Text span fw={600} inherit>
              {t("This space is archived.")}
            </Text>{" "}
            <Text span inherit className={classes.meta}>
              {space.archivedBy?.name
                ? t("Archived by {{name}} on {{date}}.", {
                    name: space.archivedBy.name,
                    date,
                  })
                : t("Archived on {{date}}.", { date })}
            </Text>
          </Text>
        </Group>
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
    </Paper>
  );
}
