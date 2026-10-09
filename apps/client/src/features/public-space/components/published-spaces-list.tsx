import { Table, Group, Text, Anchor, Menu, ActionIcon } from "@mantine/core";
import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconCopy,
  IconDots,
  IconExternalLink,
  IconWorld,
  IconWorldOff,
} from "@tabler/icons-react";
import Paginate from "@/components/common/paginate.tsx";
import { useCursorPaginate } from "@/hooks/use-cursor-paginate";
import {
  usePublishedSpacesQuery,
  usePublishSpaceMutation,
} from "@/features/public-space/queries/public-space-query.ts";
import { IPublishedSpaceItem } from "@/features/public-space/types/public-space.types.ts";
import { buildPublicSpaceUrl } from "@/features/page/page.utils.ts";
import { getAppUrl, getSpaceUrl } from "@/lib/config.ts";
import { useClipboard } from "@/hooks/use-clipboard";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import rowClasses from "@/components/ui/clickable-table-row.module.css";

export default function PublishedSpacesList() {
  const { t } = useTranslation();
  const { cursor, goNext, goPrev } = useCursorPaginate();
  const { data, isLoading } = usePublishedSpacesQuery({ cursor });
  const locale = useDateFnsLocale();

  if (!isLoading && data?.items.length === 0) {
    return <EmptyState icon={IconWorld} title={t("No published spaces")} />;
  }

  return (
    <>
      <Table.ScrollContainer minWidth={500}>
        <Table verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Space")}</Table.Th>
              <Table.Th>{t("Published by")}</Table.Th>
              <Table.Th>{t("Published at")}</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {data?.items.map((item: IPublishedSpaceItem) => (
              <Table.Tr key={item.id} className={rowClasses.row}>
                <Table.Td>
                  <Anchor
                    size="sm"
                    underline="never"
                    style={{
                      cursor: "pointer",
                      color: "var(--mantine-color-text)",
                    }}
                    className={rowClasses.link}
                    href={buildPublicSpaceUrl({ spaceSlug: item.space.slug })}
                    target="_blank"
                  >
                    <Group gap="8" wrap="nowrap">
                      <CustomAvatar
                        name={item.space.name}
                        avatarUrl={item.space.logo}
                        type={AvatarIconType.SPACE_ICON}
                        color="initials"
                        variant="filled"
                        size={20}
                        radius="sm"
                      />
                      <Text fz="sm" fw={500} lineClamp={1}>
                        {item.space.name}
                      </Text>
                    </Group>
                  </Anchor>
                </Table.Td>
                <Table.Td>
                  <Group gap="4" wrap="nowrap">
                    <CustomAvatar
                      avatarUrl={item.creator?.avatarUrl}
                      name={item.creator?.name}
                      size="sm"
                    />
                    <Text fz="sm" lineClamp={1}>
                      {item.creator?.name}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                    {formatLocalized(
                      item.createdAt,
                      "MMM dd, yyyy",
                      "PP",
                      locale,
                    )}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <PublishedSpaceActionMenu item={item} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {data?.items.length > 0 && (
        <Paginate
          hasPrevPage={data?.meta?.hasPrevPage}
          hasNextPage={data?.meta?.hasNextPage}
          onNext={() => goNext(data?.meta?.nextCursor)}
          onPrev={goPrev}
        />
      )}
    </>
  );
}

function PublishedSpaceActionMenu({ item }: { item: IPublishedSpaceItem }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const clipboard = useClipboard();
  const publishMutation = usePublishSpaceMutation();

  const publicPath = buildPublicSpaceUrl({ spaceSlug: item.space.slug });

  const copyLink = () => {
    clipboard.copy(`${getAppUrl()}${publicPath}`);
    notifications.show({ message: t("Link copied") });
  };

  const onUnpublish = async () => {
    try {
      await publishMutation.mutateAsync({
        spaceId: item.spaceId,
        enabled: false,
      });
    } catch {
      // error handled by mutation
    }
  };

  const openUnpublishModal = () =>
    modals.openConfirmModal({
      title: t("Unpublish space"),
      children: (
        <Text size="sm">
          {t(
            "This space will no longer be publicly accessible. Are you sure?",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Unpublish"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: onUnpublish,
    });

  return (
    <Menu
      shadow="xl"
      position="bottom-end"
      offset={20}
      width={200}
      withArrow
      arrowPosition="center"
    >
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          c="gray"
          aria-label={t("More options for {{name}}", {
            name: item.space.name,
          })}
        >
          <IconDots size={20} stroke={2} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item onClick={copyLink} leftSection={<IconCopy size={16} />}>
          {t("Copy link")}
        </Menu.Item>

        <Menu.Item
          onClick={() => navigate(getSpaceUrl(item.space.slug))}
          leftSection={<IconExternalLink size={16} />}
        >
          {t("Open space")}
        </Menu.Item>

        <Menu.Item
          c="red"
          onClick={openUnpublishModal}
          leftSection={<IconWorldOff size={16} />}
          disabled={item.space?.userRole !== "admin"}
        >
          {t("Unpublish")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
