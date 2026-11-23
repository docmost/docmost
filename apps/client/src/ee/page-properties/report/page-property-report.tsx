import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { Link } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Flex,
  Group,
  Loader,
  Modal,
  MultiSelect,
  ScrollArea,
  Select,
  Stack,
  Table,
  TagsInput,
  Text,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconAdjustmentsHorizontal,
  IconArrowDown,
  IconArrowUp,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api-client";
import { buildPageUrl } from "@/features/page/page.utils";
import { useViewerDateContext } from "@/ee/base/hooks/use-viewer-date-context";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { getSpaces } from "@/features/space/services/space-service";
import { useWorkspaceLabelsQuery } from "@/features/label/queries/label-query";
import type { PageProperty } from "../page-property.types";
import { PagePropertyValue } from "../page-property-value";
import { ReportFilters, needsValue, type ReportFilter } from "./report-filters";

type Props = {
  pageId: string;
  spaceId: string;
  properties: PageProperty[];
  opened: boolean;
  onClose: () => void;
};
type ReportCell = Pick<
  PageProperty,
  "name" | "type" | "value" | "typeOptions"
> & { column: number };
type ReportPage = {
  id: string;
  slugId: string;
  title: string | null;
  spaceSlug: string;
  spaceName: string;
  properties: ReportCell[];
};
type ReportResponse = { items: ReportPage[]; nextCursor: string | null };
type Scope = "current" | "selected" | "all";
type Direction = "asc" | "desc";

export function PagePropertyReport(props: Props) {
  const { t } = useTranslation();
  return (
    <Modal
      opened={props.opened}
      onClose={props.onClose}
      title={t("Property report")}
      closeButtonProps={{ "aria-label": t("Close") }}
      size="min(72rem, 96vw)"
      centered
    >
      {props.opened && <ReportContent key={props.pageId} {...props} />}
    </Modal>
  );
}

function ReportContent({ pageId, spaceId, properties, onClose }: Props) {
  const { t } = useTranslation();
  const user = useAtomValue(userAtom);
  const { timeZone } = useViewerDateContext();
  const [configure, setConfigure] = useState(false);
  const [ids, setIds] = useState(() => properties.slice(0, 6).map((p) => p.id));
  const [scope, setScope] = useState<Scope>("current");
  const [spaces, setSpaces] = useState<string[]>([]);
  const [spaceSearch, setSpaceSearch] = useState("");
  const [spaceNames, setSpaceNames] = useState<Record<string, string>>({});
  const [debouncedSpaceSearch] = useDebouncedValue(spaceSearch, 200);
  const [labels, setLabels] = useState<string[]>([]);
  const [labelSearch, setLabelSearch] = useState("");
  const [debouncedLabelSearch] = useDebouncedValue(labelSearch, 200);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [sortId, setSortId] = useState("title");
  const [direction, setDirection] = useState<Direction>("asc");
  const [cursors, setCursors] = useState<(string | null)[]>([null]);

  const selected = ids.flatMap((id) => properties.filter((p) => p.id === id));
  const activeFilters = filters.filter((filter) =>
    ids.includes(filter.fieldId),
  );
  const makeQuery = () => ({
    fields: selected.map(({ name, type }) => ({ name, type })),
    spaceIds:
      scope === "all" ? undefined : scope === "current" ? [spaceId] : spaces,
    labels,
    filters: activeFilters.map((filter) => ({
      field: ids.indexOf(filter.fieldId),
      operator: filter.operator,
      value: needsValue(filter) ? filter.value : undefined,
    })),
    sort: {
      field: ids.includes(sortId) ? ids.indexOf(sortId) : "title",
      direction,
    },
    limit: 25,
  });
  const [query, setQuery] = useState(makeQuery);
  const cursor = cursors[cursors.length - 1];
  const result = useQuery({
    queryKey: [
      "page-property-report",
      user?.id,
      pageId,
      query,
      timeZone,
      cursor,
    ],
    queryFn: async ({ signal }) =>
      (
        await api.post<ReportResponse>(
          "/pages/properties/report",
          {
            ...query,
            timeZone,
            cursor: cursor ?? undefined,
          },
          { signal },
        )
      ).data,
    enabled: !!user?.id && query.fields.length > 0,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    // A foreground report can miss a socket event during a membership change.
    refetchInterval: 60_000,
  });
  const spaceOptions = useQuery({
    queryKey: ["page-property-report-spaces", user?.id, debouncedSpaceSearch],
    queryFn: () =>
      getSpaces({ limit: 50, status: "active", query: debouncedSpaceSearch }),
    enabled: configure && scope === "selected",
  });
  const labelOptions = useWorkspaceLabelsQuery(debouncedLabelSearch, configure);
  const choices = new Map(spaces.map((id) => [id, spaceNames[id] || id]));
  for (const space of spaceOptions.data?.items ?? [])
    choices.set(space.id, space.name);
  const valid =
    selected.length > 0 &&
    (scope !== "selected" || spaces.length > 0) &&
    activeFilters.every(
      (f) =>
        !needsValue(f) ||
        (f.value !== "" &&
          (selected.find((p) => p.id === f.fieldId)?.type !== "number" ||
            typeof f.value === "number")),
    );
  return (
    <Stack gap="md">
      <Group justify="space-between" gap="xs">
        <Text size="sm" c="dimmed">
          {!query.spaceIds
            ? t("All my spaces")
            : query.spaceIds.length === 1 && query.spaceIds[0] === spaceId
              ? t("This space")
              : t("Selected spaces")}
        </Text>
        <Button
          size="compact-sm"
          variant={configure ? "light" : "subtle"}
          color="gray"
          leftSection={<IconAdjustmentsHorizontal size={16} />}
          aria-expanded={configure}
          onClick={() => setConfigure(!configure)}
        >
          {t("Configure report")}
        </Button>
      </Group>
      {configure && (
        <Stack gap="sm" pb="sm">
          <MultiSelect
            label={t("Properties")}
            value={ids}
            maxValues={12}
            searchable
            data={properties.map((p) => ({ value: p.id, label: p.name }))}
            onChange={setIds}
          />
          <Flex gap="sm" wrap="wrap">
            <Select
              label={t("Scope")}
              value={scope}
              allowDeselect={false}
              style={{ flex: "1 1 11rem" }}
              data={[
                { value: "current", label: t("This space") },
                { value: "selected", label: t("Selected spaces") },
                { value: "all", label: t("All my spaces") },
              ]}
              onChange={(v) => v && setScope(v as Scope)}
            />
            {scope === "selected" && (
              <MultiSelect
                label={t("Spaces")}
                searchable
                clearable
                value={spaces}
                searchValue={spaceSearch}
                onSearchChange={setSpaceSearch}
                maxValues={100}
                style={{ flex: "1 1 15rem" }}
                data={Array.from(choices, ([value, label]) => ({
                  value,
                  label,
                }))}
                onChange={(v) => {
                  setSpaceNames(Object.fromEntries(choices));
                  setSpaces(v);
                }}
              />
            )}
            <TagsInput
              label={t("Labels")}
              placeholder={t("Any label")}
              value={labels}
              onChange={setLabels}
              maxTags={20}
              searchValue={labelSearch}
              onSearchChange={setLabelSearch}
              data={labelOptions.data?.items.map((label) => label.name) ?? []}
              style={{ flex: "1 1 12rem" }}
            />
          </Flex>
          <ReportFilters
            fields={selected}
            filters={activeFilters}
            onChange={setFilters}
          />
          <Group gap="xs" align="flex-end">
            <Select
              label={t("Sort by")}
              allowDeselect={false}
              value={ids.includes(sortId) ? sortId : "title"}
              data={[
                { value: "title", label: t("Page title") },
                ...selected.map((p) => ({ value: p.id, label: p.name })),
              ]}
              onChange={(value) => value && setSortId(value)}
            />
            <ActionIcon
              variant="default"
              size="input-sm"
              title={direction === "asc" ? t("Ascending") : t("Descending")}
              aria-label={
                direction === "asc" ? t("Ascending") : t("Descending")
              }
              onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}
            >
              {direction === "asc" ? (
                <IconArrowUp size={17} />
              ) : (
                <IconArrowDown size={17} />
              )}
            </ActionIcon>
            <Button
              ml="auto"
              disabled={!valid}
              onClick={() => {
                setQuery(makeQuery());
                setCursors([null]);
                setConfigure(false);
              }}
            >
              {t("Apply")}
            </Button>
          </Group>
        </Stack>
      )}
      {result.isPending ||
      result.isFetching ||
      (!result.isError && !result.isFetchedAfterMount) ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      ) : result.isError ? (
        <Alert color="red">{t("Could not load the property report.")}</Alert>
      ) : result.data.items.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          {t("No pages match this report.")}
        </Text>
      ) : (
        <ScrollArea type="auto" offsetScrollbars>
          <Table horizontalSpacing="sm" verticalSpacing="sm" fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("Page")}</Table.Th>
                {query.fields.map((field) => (
                  <Table.Th key={field.name} style={{ whiteSpace: "nowrap" }}>
                    {field.name}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.data.items.map((page) => (
                <Table.Tr key={page.id}>
                  <Table.Td miw={160}>
                    <Anchor
                      component={Link}
                      size="sm"
                      fw={500}
                      onClick={onClose}
                      to={buildPageUrl(
                        page.spaceSlug,
                        page.slugId,
                        page.title ?? undefined,
                      )}
                    >
                      {page.title || t("Untitled")}
                    </Anchor>
                    <Text size="xs" c="dimmed">
                      {page.spaceName}
                    </Text>
                  </Table.Td>
                  {query.fields.map((field, i) => {
                    const cell = page.properties.find((p) => p.column === i);
                    return (
                      <Table.Td key={field.name}>
                        <Box
                          w="max-content"
                          maw={300}
                          style={{ overflowWrap: "anywhere" }}
                        >
                          {cell ? (
                            <PagePropertyValue property={cell} compact />
                          ) : (
                            <Text c="dimmed" size="sm">
                              —
                            </Text>
                          )}
                        </Box>
                      </Table.Td>
                    );
                  })}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
      {(cursor || result.data?.nextCursor) && (
        <Group justify="flex-end" gap="xs">
          <Button
            variant="default"
            size="compact-sm"
            leftSection={<IconChevronLeft size={14} />}
            disabled={!cursor}
            onClick={() => setCursors(cursors.slice(0, -1))}
          >
            {t("Previous")}
          </Button>
          <Button
            variant="default"
            size="compact-sm"
            rightSection={<IconChevronRight size={14} />}
            disabled={!result.data?.nextCursor}
            onClick={() =>
              result.data?.nextCursor &&
              setCursors([...cursors, result.data.nextCursor])
            }
          >
            {t("Next")}
          </Button>
        </Group>
      )}
    </Stack>
  );
}
