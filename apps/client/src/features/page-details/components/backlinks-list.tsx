import {
  Button,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBacklinksQuery } from "@/features/page-details/queries/backlinks-query.ts";
import {
  BacklinkDirection,
  IBacklinkPageItem,
} from "@/features/page-details/types/backlink.types.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { getPageIcon } from "@/lib";

interface BacklinksListProps {
  pageId: string;
  direction: BacklinkDirection;
  enabled: boolean;
  onItemClick: () => void;
}

export function BacklinksList({
  pageId,
  direction,
  enabled,
  onItemClick,
}: BacklinksListProps) {
  const { t } = useTranslation();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useBacklinksQuery(pageId, direction, enabled);

  if (!enabled) return null;

  if (isLoading) {
    return (
      <Center py="sm">
        <Loader size="sm" />
      </Center>
    );
  }

  const items: IBacklinkPageItem[] =
    data?.pages.flatMap((page) => page.items) ?? [];

  if (items.length === 0) {
    return (
      <Text c="dimmed" size="sm" py="md">
        {direction === "incoming"
          ? t("No pages link here yet.")
          : t("This page doesn't link to other pages yet.")}
      </Text>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
      return;
    }
    onItemClick();
  };

  return (
    <Stack gap={4}>
      {items.map((item) => (
        <UnstyledButton
          key={item.id}
          component={Link}
          to={
            item.space?.slug
              ? buildPageUrl(
                  item.space.slug,
                  item.slugId,
                  item.title ?? undefined,
                )
              : "#"
          }
          onClick={handleClick}
          style={{ padding: "8px 4px", borderRadius: 4, userSelect: "none" }}
        >
          <Group gap="xs" wrap="nowrap">
            {getPageIcon(item.icon ?? "")}
            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={500} lineClamp={1}>
                {item.title || t("Untitled")}
              </Text>
              {item.space?.name && (
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {item.space.name}
                </Text>
              )}
            </Stack>
          </Group>
        </UnstyledButton>
      ))}
      {hasNextPage && (
        <Button
          variant="subtle"
          size="xs"
          loading={isFetchingNextPage}
          onClick={() => fetchNextPage()}
          mt="xs"
        >
          {t("Load more")}
        </Button>
      )}
    </Stack>
  );
}
