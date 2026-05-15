import { ActionIcon, Button, Group, Paper, Text, Tooltip } from "@mantine/core";
import { IconRestore, IconTrash } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useTimeAgo } from "@/hooks/use-time-ago.tsx";
import { useRestorePageModal } from "@/features/page/hooks/use-restore-page-modal.tsx";
import { useDeletePageModal } from "@/features/page/hooks/use-delete-page-modal.tsx";
import {
  useDeletePageMutation,
  usePageQuery,
  useRestorePageMutation,
} from "@/features/page/queries/page-query.ts";
import { getSpaceUrl } from "@/lib/config.ts";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";

type DeletedPageBannerProps = {
  slugId: string;
};

export function DeletedPageBanner({ slugId }: DeletedPageBannerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: page } = usePageQuery({ pageId: slugId });
  const { data: space } = useGetSpaceBySlugQuery(page?.space?.slug);
  const spaceAbility = useSpaceAbility(space?.membership?.permissions);
  const deletedTimeAgo = useTimeAgo(page?.deletedAt);
  const restorePageMutation = useRestorePageMutation();
  const deletePageMutation = useDeletePageMutation();
  const { openRestoreModal } = useRestorePageModal();
  const { openDeleteModal } = useDeletePageModal();

  if (!page?.deletedAt) return null;

  const canRestore = spaceAbility.can(
    SpaceCaslAction.Edit,
    SpaceCaslSubject.Page,
  );
  const canPermanentlyDelete = spaceAbility.can(
    SpaceCaslAction.Manage,
    SpaceCaslSubject.Settings,
  );
  const actorName = page.deletedBy?.name ?? t("Someone");

  const handleRestore = () => {
    openRestoreModal({
      title: page.title,
      onConfirm: () => restorePageMutation.mutate(page.id),
    });
  };

  const handlePermanentDelete = () => {
    openDeleteModal({
      isPermanent: true,
      onConfirm: async () => {
        await deletePageMutation.mutateAsync(page.id);
        navigate(getSpaceUrl(page.space?.slug));
      },
    });
  };

  const hasAnyAction = canRestore || canPermanentlyDelete;

  return (
    <Paper radius="sm" mb="md" px="md" py="xs" bg="red.0">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Text size="sm" style={{ flex: 1, minWidth: 0 }}>
          <Trans
            i18nKey="<b>{{name}}</b> moved this page to Trash {{time}}."
            values={{ name: actorName, time: deletedTimeAgo }}
            components={{ b: <Text span fw={600} inherit /> }}
          />
        </Text>
        {hasAnyAction && (
          <>
            <Group gap="xs" wrap="nowrap" visibleFrom="sm">
              {canRestore && (
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  leftSection={<IconRestore size={16} />}
                  onClick={handleRestore}
                  loading={restorePageMutation.isPending}
                >
                  {t("Restore page")}
                </Button>
              )}
              {canPermanentlyDelete && (
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={handlePermanentDelete}
                  loading={deletePageMutation.isPending}
                >
                  {t("Permanently delete")}
                </Button>
              )}
            </Group>
            <Group gap="xs" wrap="nowrap" hiddenFrom="sm">
              {canRestore && (
                <Tooltip label={t("Restore page")} withArrow>
                  <ActionIcon
                    size="lg"
                    variant="default"
                    onClick={handleRestore}
                    loading={restorePageMutation.isPending}
                    aria-label={t("Restore page")}
                  >
                    <IconRestore size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
              {canPermanentlyDelete && (
                <Tooltip label={t("Permanently delete")} withArrow>
                  <ActionIcon
                    size="lg"
                    variant="light"
                    color="red"
                    onClick={handlePermanentDelete}
                    loading={deletePageMutation.isPending}
                    aria-label={t("Permanently delete")}
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </>
        )}
      </Group>
    </Paper>
  );
}
