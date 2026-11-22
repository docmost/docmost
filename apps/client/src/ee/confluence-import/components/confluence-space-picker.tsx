import {
  Alert,
  Button,
  Checkbox,
  Group,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { getConfluenceSpaceBatch } from "../services/confluence-import-service";
import type {
  ConfluenceCredentials,
  ConfluenceSpacePosition,
} from "../types/confluence-import.types";

type Props = {
  credentials: ConfluenceCredentials;
  selectedKeys: string[];
  onToggle: (key: string, checked: boolean) => void;
};

export default function ConfluenceSpacePicker({
  credentials,
  selectedKeys,
  onToggle,
}: Props) {
  const { t } = useTranslation();
  const pickerId = useId();
  const [pageIndex, setPageIndex] = useState(0);
  const {
    data,
    error,
    isPending,
    isFetching,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["confluence-space-picker", pickerId],
    initialPageParam: { status: "current" } as ConfluenceSpacePosition,
    queryFn: ({ pageParam, signal }) =>
      getConfluenceSpaceBatch(credentials, pageParam, signal),
    getNextPageParam: (page) => page.next,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
  const page = data?.pages[pageIndex];
  const cachedNext = !!data?.pages[pageIndex + 1]?.spaces.length;
  const pageError = !cachedNext && error;

  async function nextPage() {
    if (cachedNext) {
      setPageIndex(pageIndex + 1);
      return;
    }
    const result = await fetchNextPage({ cancelRefetch: false });
    if (result.data?.pages[pageIndex + 1]?.spaces.length) {
      setPageIndex(pageIndex + 1);
    }
  }

  return (
    <Stack gap="xs">
      {isPending && (
        <Text role="status" size="sm">
          {t("Loading…")}
        </Text>
      )}
      {page &&
        (page.spaces.length ? (
          <ScrollArea.Autosize
            key={pageIndex}
            mah={320}
            type="auto"
            offsetScrollbars
          >
            <Stack gap="xs">
              {page.spaces.map((space) => (
                <Checkbox
                  key={space.id}
                  label={
                    <Group gap={6} wrap="nowrap">
                      <Text fw={500}>{space.name}</Text>
                      <Text size="xs" c="dimmed">
                        ({space.key})
                      </Text>
                    </Group>
                  }
                  checked={selectedKeys.includes(space.key)}
                  onChange={(e) => onToggle(space.key, e.currentTarget.checked)}
                />
              ))}
            </Stack>
          </ScrollArea.Autosize>
        ) : (
          <Text size="sm" c="dimmed">
            {t("No spaces found")}
          </Text>
        ))}
      {pageError && (
        <Alert color="red">
          {pageError.message || t("Failed to load spaces")}
          <Button
            size="compact-sm"
            variant="subtle"
            onClick={() => (page ? nextPage() : refetch())}
            loading={isFetching}
          >
            {t("Try again")}
          </Button>
        </Alert>
      )}
      {(pageIndex > 0 || cachedNext || hasNextPage) && (
        <Group gap="xs" justify="flex-end">
          <Button
            size="compact-sm"
            variant="default"
            disabled={pageIndex === 0 || isFetching}
            onClick={() => setPageIndex(pageIndex - 1)}
          >
            {t("Previous")}
          </Button>
          <Button
            size="compact-sm"
            variant="default"
            disabled={(!cachedNext && !hasNextPage) || !!pageError}
            loading={isFetching}
            onClick={nextPage}
          >
            {t("Next")}
          </Button>
        </Group>
      )}
    </Stack>
  );
}
