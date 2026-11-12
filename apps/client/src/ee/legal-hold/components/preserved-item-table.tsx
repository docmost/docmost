import { useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Group,
  Select,
  Skeleton,
  Table,
  Text,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import NoTableResults from "@/components/common/no-table-results";
import Paginate from "@/components/common/paginate";
import { SearchInput } from "@/components/common/search-input";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import rowClasses from "@/components/ui/clickable-table-row.module.css";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale";
import { formattedDate } from "@/lib/time";
import { PreservedItemPreviewModal } from "@/ee/legal-hold/components/preserved-item-preview-modal";
import {
  PRESERVATION_REASON_BADGES,
  PRESERVED_ITEM_TYPE_LABELS,
} from "@/ee/legal-hold/legal-hold.utils";
import { usePreservedItemsQuery } from "@/ee/legal-hold/queries/legal-hold-query";
import type {
  PreservedItemType,
  PreservedItemView,
} from "@/ee/legal-hold/types/legal-hold.types";

const ALL_TYPES = "all";

type PreservedItemTableProps = {
  legalHoldId: string;
};

function TableSkeleton() {
  return (
    <>
      {[220, 160, 260, 190].map((width) => (
        <Table.Tr key={width}>
          <Table.Td>
            <Skeleton height={14} width={width} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={70} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={20} width={64} radius="xl" />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={100} />
          </Table.Td>
          <Table.Td>
            <Group gap={8} wrap="nowrap">
              <Skeleton height={26} width={26} circle />
              <Skeleton height={14} width={80} />
            </Group>
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={140} />
          </Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

export function PreservedItemTable({ legalHoldId }: PreservedItemTableProps) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const { search, cursor, goNext, goPrev, handleSearch, resetPagination } =
    usePaginateAndSearch();
  const [type, setType] = useState<PreservedItemType | null>(null);
  const [previewItem, setPreviewItem] = useState<PreservedItemView | null>(
    null,
  );
  const [previewOpened, setPreviewOpened] = useState(false);
  const query = usePreservedItemsQuery({
    legalHoldId,
    cursor,
    limit: 20,
    query: search,
    ...(type ? { type } : {}),
  });
  const items = query.data?.items ?? [];

  const openPreview = (item: PreservedItemView) => {
    setPreviewItem(item);
    setPreviewOpened(true);
  };

  return (
    <>
      <Group gap="sm" align="flex-start">
        <SearchInput onSearch={handleSearch} />
        <Select
          size="sm"
          w={190}
          aria-label={t("Type")}
          data={[
            { value: ALL_TYPES, label: t("All types") },
            ...Object.entries(PRESERVED_ITEM_TYPE_LABELS).map(
              ([value, label]) => ({ value, label: t(label) }),
            ),
          ]}
          value={type ?? ALL_TYPES}
          onChange={(value) => {
            setType(value === ALL_TYPES ? null : (value as PreservedItemType));
            resetPagination();
          }}
          allowDeselect={false}
          checkIconPosition="right"
        />
      </Group>

      {query.isError && !query.data ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {getApiErrorMessage(
            query.error,
            t("Failed to load preserved content"),
          )}
        </Alert>
      ) : (
        <Table.ScrollContainer minWidth={860}>
          <Table
            highlightOnHover
            verticalSpacing="sm"
            aria-busy={query.isLoading}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("Item")}</Table.Th>
                <Table.Th>{t("Type")}</Table.Th>
                <Table.Th>{t("Reason")}</Table.Th>
                <Table.Th>{t("Space")}</Table.Th>
                <Table.Th>{t("By")}</Table.Th>
                <Table.Th>{t("Preserved")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {query.isLoading ? (
                <TableSkeleton />
              ) : items.length > 0 ? (
                items.map((item) => {
                  const typeLabel = PRESERVED_ITEM_TYPE_LABELS[item.type];
                  const reason = PRESERVATION_REASON_BADGES[item.reason];
                  return (
                    <Table.Tr
                      key={item.id}
                      className={rowClasses.row}
                      style={{ cursor: "pointer" }}
                      onClick={() => openPreview(item)}
                    >
                      <Table.Td>
                        {/* the row handles the click, the button gives keyboard access */}
                        <Anchor
                          component="button"
                          type="button"
                          underline="never"
                          aria-haspopup="dialog"
                          className={rowClasses.link}
                          style={{
                            color: "var(--mantine-color-text)",
                            textAlign: "start",
                          }}
                        >
                          <Text span fz="sm" fw={500} lineClamp={1}>
                            {item.title || t("Untitled")}
                          </Text>
                        </Anchor>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                          {typeLabel ? t(typeLabel) : item.type}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={reason?.color ?? "gray"}>
                          {reason ? t(reason.label) : item.reason}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" lineClamp={1}>
                          {item.spaceName}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {item.actor && (
                          <Group gap={8} wrap="nowrap">
                            <CustomAvatar
                              size="sm"
                              avatarUrl={item.actor.avatarUrl}
                              name={item.actor.name}
                            />
                            <Text fz="sm" lineClamp={1}>
                              {item.actor.name}
                            </Text>
                          </Group>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                          {formattedDate(new Date(item.createdAt))}
                        </Text>
                        {item.purgeAt && (
                          <Text
                            fz="xs"
                            c="dimmed"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {t("Removed on {{date}}", {
                              date: formatLocalized(
                                item.purgeAt,
                                "MMM d, yyyy",
                                "PP",
                                locale,
                              ),
                            })}
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })
              ) : (
                <NoTableResults
                  colSpan={6}
                  text={
                    search || type
                      ? t("No results found...")
                      : t("Nothing preserved yet.")
                  }
                />
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {items.length > 0 && (
        <Paginate
          hasPrevPage={query.data.meta.hasPrevPage}
          hasNextPage={query.data.meta.hasNextPage}
          onNext={() => goNext(query.data.meta.nextCursor)}
          onPrev={goPrev}
        />
      )}

      <PreservedItemPreviewModal
        opened={previewOpened}
        onClose={() => setPreviewOpened(false)}
        legalHoldId={legalHoldId}
        item={previewItem}
      />
    </>
  );
}
