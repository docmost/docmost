import { useState, type UIEvent } from "react";
import {
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconCheck, IconRestore } from "@tabler/icons-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import IconDrawio from "@/components/icons/icon-drawio";
import IconExcalidraw from "@/components/icons/icon-excalidraw";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import {
  diagramFileUrl,
  getDiagramHistory,
  type DiagramRevision,
} from "@/features/attachments/services/diagram-service";
import type { DiagramType } from "@/features/attachments/types/attachment.types";
import { getFileUrl } from "@/lib/config";
import { formattedDate } from "@/lib/time";
import { diagramName } from "./diagram-name";
import classes from "./diagram-history.module.css";

function RevisionDetails({
  item,
  current,
}: {
  item: DiagramRevision;
  current: boolean;
}) {
  const { t, i18n } = useTranslation();
  const date = new Date(item.createdAt);
  return (
    <Stack gap={3} miw={0} w="100%">
      <Group gap="xs" wrap="nowrap">
        <Text size="sm" fw={600}>
          {t("Version {{number}}", { number: item.version })}
        </Text>
        {current && (
          <Badge size="sm" color="gray" variant="light" tt="none">
            {t("Current")}
          </Badge>
        )}
      </Group>
      <Text
        component="time"
        dateTime={item.createdAt}
        title={date.toLocaleString(i18n.language)}
        size="xs"
        c="dimmed"
      >
        {formattedDate(date)}
      </Text>
      {item.creator && (
        <Group gap={6} wrap="nowrap">
          <span aria-hidden="true">
            <CustomAvatar
              size={18}
              name={item.creator.name}
              avatarUrl={item.creator.avatarUrl}
            />
          </span>
          <Text size="xs" truncate>
            {item.creator.name}
          </Text>
        </Group>
      )}
    </Stack>
  );
}

function DiagramPreview({ item }: { item: DiagramRevision }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  return (
    <div className={classes.canvas} aria-busy={status === "loading"}>
      {status === "loading" && (
        <Loader size="sm" aria-label={t("Loading preview")} />
      )}
      {status === "error" ? (
        <Text size="sm" c="dimmed" role="status">
          {t("Preview not available")}
        </Text>
      ) : (
        <img
          src={getFileUrl(diagramFileUrl(item))}
          alt={item.fileName}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
          style={{ visibility: status === "ready" ? "visible" : "hidden" }}
        />
      )}
    </div>
  );
}

type DiagramHistoryModalProps = {
  attachmentId: string;
  type: DiagramType;
  restoring: boolean;
  onRestore: (revision: DiagramRevision) => void;
  onClose: () => void;
};

export function DiagramHistoryModal({
  attachmentId,
  type,
  restoring,
  onRestore,
  onClose,
}: DiagramHistoryModalProps) {
  const { t } = useTranslation();
  const mobile = useMediaQuery("(max-width: 800px)");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const history = useInfiniteQuery({
    queryKey: ["diagram-history", attachmentId],
    queryFn: ({ pageParam }) => getDiagramHistory(attachmentId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => {
      const oldest = page.at(-1);
      return oldest?.version > 1 ? oldest.id : undefined;
    },
    gcTime: 0,
  });
  const items = history.data?.pages.flat() ?? [];
  const revisionsById = new Map(items.map((item) => [item.id, item]));
  const selected =
    (selectedId && revisionsById.get(selectedId)) ||
    history.data?.pages[0]?.find((item) => item.id === attachmentId) ||
    items[0];
  const versionLabel = (item: DiagramRevision) =>
    t("Version {{number}}", { number: item.version });
  const loadMore = () => {
    if (history.hasNextPage && !history.isFetching)
      void history.fetchNextPage({ cancelRefetch: false });
  };
  const handleVersionsScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
    if (
      !history.isFetchNextPageError &&
      scrollTop + clientHeight >= scrollHeight - 50
    ) {
      loadMore();
    }
  };
  const loadingMore = history.isFetchingNextPage ? (
    <Loader size="xs" role="status" aria-label={t("Loading…")} />
  ) : undefined;
  const retryButton = history.isFetchNextPageError &&
    !history.isFetchingNextPage && (
      <Button variant="subtle" color="gray" size="xs" onClick={loadMore}>
        {t("Try again")}
      </Button>
    );

  return (
    <Modal
      opened
      centered
      size={1400}
      fullScreen={mobile}
      title={t("Diagram history")}
      onClose={() => {
        if (!restoring) onClose();
      }}
      closeButtonProps={{ "aria-label": t("Close"), disabled: restoring }}
      classNames={{
        content: classes.modal,
        header: classes.header,
        title: classes.title,
        body: classes.body,
      }}
    >
      {selected ? (
        <>
          {mobile ? (
            <Group className={classes.picker} gap="xs" wrap="nowrap">
              <Select<string>
                aria-label={t("Select version")}
                flex={1}
                miw={0}
                value={selected.id}
                onChange={setSelectedId}
                allowDeselect={false}
                disabled={restoring}
                data={items.map((item) => ({
                  value: item.id,
                  label:
                    item.id === attachmentId
                      ? `${versionLabel(item)} · ${t("Current")}`
                      : versionLabel(item),
                }))}
                comboboxProps={{ withinPortal: false }}
                maxDropdownHeight="min(50dvh, 320px)"
                rightSection={loadingMore}
                scrollAreaProps={{
                  viewportProps: { onScroll: handleVersionsScroll },
                }}
                renderOption={({ option, checked }) => (
                  <>
                    <RevisionDetails
                      item={revisionsById.get(option.value)!}
                      current={option.value === attachmentId}
                    />
                    {checked && <IconCheck size={16} aria-hidden />}
                  </>
                )}
              />
              {retryButton}
            </Group>
          ) : (
            <nav className={classes.sidebar} aria-label={t("Versions")}>
              <Text className={classes.listHeading} size="sm" fw={600}>
                {t("Versions")}
              </Text>
              <div className={classes.list} onScroll={handleVersionsScroll}>
                {items.map((item) => (
                  <UnstyledButton
                    key={item.id}
                    className={classes.revision}
                    aria-pressed={selected.id === item.id}
                    disabled={restoring}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <RevisionDetails
                      item={item}
                      current={item.id === attachmentId}
                    />
                  </UnstyledButton>
                ))}
                {loadingMore && <Center py="xs">{loadingMore}</Center>}
                {retryButton}
              </div>
            </nav>
          )}
          <div className={classes.preview}>
            <Group
              className={classes.toolbar}
              wrap="nowrap"
              justify="space-between"
              gap="sm"
            >
              <Group wrap="nowrap" gap="xs" miw={0}>
                <span className={classes.formatIcon} aria-hidden="true">
                  {type === "drawio" ? (
                    <IconDrawio size={20} />
                  ) : (
                    <IconExcalidraw size={20} />
                  )}
                </span>
                <Text fw={600} truncate title={selected.fileName}>
                  {diagramName(selected.fileName) || selected.fileName}
                </Text>
              </Group>
              {selected.id !== attachmentId && (
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconRestore size={15} />}
                  loading={restoring}
                  onClick={() => onRestore(selected)}
                >
                  {t("Restore version")}
                </Button>
              )}
            </Group>
            <DiagramPreview key={selected.id} item={selected} />
          </div>
        </>
      ) : (
        <Center className={classes.empty}>
          {history.isPending ? (
            <Loader size="sm" aria-label={t("Loading…")} />
          ) : (
            <Stack gap="xs" align="center">
              <Text size="sm" c="dimmed" role="status">
                {history.isError
                  ? t("Could not load diagram history")
                  : t("No diagram versions yet")}
              </Text>
              {history.isError && (
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => void history.refetch()}
                >
                  {t("Try again")}
                </Button>
              )}
            </Stack>
          )}
        </Center>
      )}
    </Modal>
  );
}
