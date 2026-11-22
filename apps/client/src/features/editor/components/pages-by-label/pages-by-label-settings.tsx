import {
  Button,
  Checkbox,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQueries } from "@tanstack/react-query";
import {
  normalizePagesByLabelAttributes,
  PAGES_BY_LABEL_MAX_FILTERS,
  PAGES_BY_LABEL_MAX_HEADING_LENGTH,
  PAGES_BY_LABEL_MAX_LABEL_LENGTH,
  PAGES_BY_LABEL_MAX_LIMIT,
  type PagesByLabelAttributes,
} from "@docmost/editor-ext";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LabelFilter,
  LabelMatchSelect,
} from "@/features/label/components/label-filter";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import { getSpaceById } from "@/features/space/services/space-service";

type FilterProps = { value: string[]; onChange: (value: string[]) => void };

const labelLimits = {
  maxValues: PAGES_BY_LABEL_MAX_FILTERS,
  isWithinLength: (name: string) =>
    [...name].length <= PAGES_BY_LABEL_MAX_LABEL_LENGTH,
};

function SpaceFilter({ value, onChange }: FilterProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [query] = useDebouncedValue(search, 200);
  const { data: spaces } = useGetSpacesQuery({ query, limit: 50 });
  const options = (spaces?.items ?? []).map((space) => ({
    value: space.id,
    label: space.name,
  }));
  const listed = new Set(options.map((item) => item.value));
  const missingIds = value.filter((id) => !listed.has(id));
  const missing = useQueries({
    queries: missingIds.map((id) => ({
      queryKey: ["space", id],
      queryFn: () => getSpaceById(id),
      enabled: !!spaces,
      retry: false,
    })),
  });
  return (
    <MultiSelect
      label={t("Spaces")}
      required
      searchable
      hidePickedOptions
      placeholder={t("Search for spaces")}
      searchValue={search}
      onSearchChange={setSearch}
      data={[
        ...options,
        ...missingIds.map((id, i) => ({
          value: id,
          label: missing[i].data?.name ?? t("Unavailable space"),
        })),
      ]}
      value={value}
      onChange={onChange}
      maxValues={PAGES_BY_LABEL_MAX_FILTERS}
      nothingFoundMessage={t("No space found")}
      comboboxProps={{ withinPortal: false }}
    />
  );
}

export function PagesByLabelSettings({
  initial,
  onSave,
  onClose,
}: {
  initial: PagesByLabelAttributes;
  onSave: (changes: Partial<PagesByLabelAttributes>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial);
  const [limit, setLimit] = useState<number | string>(initial.limit);
  const update = <K extends keyof PagesByLabelAttributes>(
    key: K,
    value: PagesByLabelAttributes[K],
  ) => setDraft((previous) => ({ ...previous, [key]: value }));
  const valid =
    draft.labels.length > 0 &&
    (draft.scope !== "spaces" || draft.spaceIds.length > 0) &&
    typeof limit === "number" &&
    Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= PAGES_BY_LABEL_MAX_LIMIT;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        const options = normalizePagesByLabelAttributes({
          ...draft,
          limit,
          spaceIds: draft.scope === "spaces" ? draft.spaceIds : [],
        });
        // Preserve settings another editor changed while this dialog was open.
        const changed = Object.entries(options).filter(
          ([key, value]) =>
            JSON.stringify(value) !== JSON.stringify(initial[key]),
        );
        onSave(Object.fromEntries(changed));
      }}
    >
      <Stack>
        <LabelFilter
          {...labelLimits}
          label={t("Include labels")}
          required
          value={draft.labels}
          onChange={(v) => update("labels", v)}
        />
        {draft.labels.length > 1 && (
          <LabelMatchSelect
            value={draft.match}
            onChange={(match) => update("match", match)}
          />
        )}
        <LabelFilter
          {...labelLimits}
          label={t("Exclude labels")}
          value={draft.excludeLabels}
          onChange={(v) => update("excludeLabels", v)}
        />
        <Select
          label={t("Search in")}
          allowDeselect={false}
          value={draft.scope}
          data={[
            { value: "current", label: t("Current space") },
            { value: "spaces", label: t("Selected spaces") },
            { value: "workspace", label: t("All accessible spaces") },
          ]}
          onChange={(v) =>
            update("scope", v as PagesByLabelAttributes["scope"])
          }
          comboboxProps={{ withinPortal: false }}
        />
        {draft.scope === "spaces" && (
          <SpaceFilter
            value={draft.spaceIds}
            onChange={(v) => update("spaceIds", v)}
          />
        )}
        <SimpleGrid cols={{ base: 1, xs: 2 }}>
          <Select
            label={t("Sort by")}
            allowDeselect={false}
            value={draft.sortBy + "-" + draft.sortDirection}
            data={[
              { value: "title-asc", label: t("Title (A–Z)") },
              { value: "title-desc", label: t("Title (Z–A)") },
              {
                value: "updatedAt-desc",
                label: t("Last updated (newest first)"),
              },
              {
                value: "updatedAt-asc",
                label: t("Last updated (oldest first)"),
              },
              { value: "createdAt-desc", label: t("Created (newest first)") },
              { value: "createdAt-asc", label: t("Created (oldest first)") },
            ]}
            onChange={(value) => {
              const [sortBy, sortDirection] = value.split("-") as [
                PagesByLabelAttributes["sortBy"],
                PagesByLabelAttributes["sortDirection"],
              ];
              setDraft((previous) => ({ ...previous, sortBy, sortDirection }));
            }}
            comboboxProps={{ withinPortal: false }}
          />
          <NumberInput<number>
            label={t("Maximum results")}
            min={1}
            max={PAGES_BY_LABEL_MAX_LIMIT}
            allowDecimal={false}
            value={limit}
            onChange={setLimit}
          />
        </SimpleGrid>
        <TextInput
          label={t("Heading")}
          value={draft.heading}
          maxLength={PAGES_BY_LABEL_MAX_HEADING_LENGTH}
          onChange={(e) => update("heading", e.currentTarget.value)}
        />
        <Group>
          <Checkbox
            label={t("Show labels")}
            checked={draft.showLabels}
            onChange={(e) => update("showLabels", e.currentTarget.checked)}
          />
          <Checkbox
            label={t("Show space name")}
            checked={draft.showSpace}
            onChange={(e) => update("showSpace", e.currentTarget.checked)}
          />
          <Checkbox
            label={t("Exclude this page")}
            checked={draft.excludeCurrentPage}
            onChange={(e) =>
              update("excludeCurrentPage", e.currentTarget.checked)
            }
          />
        </Group>
        <Group justify="flex-end">
          <Button type="button" variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={!valid}>
            {t("Save")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
