import {
  Checkbox,
  Group,
  Select,
  SimpleGrid,
  Text,
  TextInput,
} from "@mantine/core";
import {
  parsePagesByLabelAttributes,
  pagesByLabelNameWithinLimit,
  PAGES_BY_LABEL_MAX_FILTERS,
  PAGES_BY_LABEL_MAX_HEADING_LENGTH,
  PAGES_BY_LABEL_MAX_LIMIT,
  type PagesByLabelAttributes,
} from "@docmost/editor-ext";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getPageListSettingsChanges,
  PageListLabelFilters,
  PageListLimitInput,
  PageListSettingsModal,
} from "../common/page-list-settings";
import { SpaceSelect } from "@/features/space/components/sidebar/space-select";
import classes from "./pages-by-label.module.css";

const labelLimits = {
  maxValues: PAGES_BY_LABEL_MAX_FILTERS,
  isWithinLength: pagesByLabelNameWithinLimit,
};

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
  const selectedSpaces =
    draft.scope === "current" ? ["current"] : draft.spaceIds;
  function changeSpaces(values: string[]) {
    const last = values.at(-1) ?? "workspace";
    const scope = last === "current" || last === "workspace" ? last : "spaces";
    const spaceIds =
      scope === "spaces"
        ? values.filter((id) => id !== "current" && id !== "workspace")
        : [];
    if (spaceIds.length <= PAGES_BY_LABEL_MAX_FILTERS) {
      setDraft((previous) => ({ ...previous, scope, spaceIds }));
    }
  }
  const defaultSortDirection = draft.sortBy === "title" ? "asc" : "desc";
  const savedOrderHint =
    draft.sortDirection === defaultSortDirection
      ? undefined
      : draft.sortBy === "title"
        ? t("Reverse alphabetical order")
        : t("Oldest first");
  const options = parsePagesByLabelAttributes({
    ...draft,
    limit,
    spaceIds: draft.scope === "spaces" ? draft.spaceIds : [],
  });
  const valid =
    !!options?.labels.length &&
    (options.scope !== "spaces" || options.spaceIds.length > 0);

  return (
    <PageListSettingsModal
      title={t("Pages by label")}
      description={t("Insert a list of pages that share labels.")}
      canSave={valid}
      onClose={onClose}
      onSave={() => {
        if (!options) return;
        const changes = getPageListSettingsChanges(initial, options);
        // Each picker edits a pair of stored attributes together.
        if ("scope" in changes || "spaceIds" in changes) {
          Object.assign(changes, {
            scope: options.scope,
            spaceIds: options.spaceIds,
          });
        }
        if ("sortBy" in changes || "sortDirection" in changes) {
          Object.assign(changes, {
            sortBy: options.sortBy,
            sortDirection: options.sortDirection,
          });
        }
        onSave(changes);
      }}
      primaryFilter={
        <PageListLabelFilters
          {...labelLimits}
          required
          labels={draft.labels}
          excludeLabels={draft.excludeLabels}
          match={draft.match}
          onLabelsChange={(labels) => update("labels", labels)}
          onExcludeLabelsChange={(labels) => update("excludeLabels", labels)}
          onMatchChange={(match) => update("match", match)}
        />
      }
      filters={
        <>
          <SpaceSelect
            multiple
            label={t("Spaces")}
            placeholder={t("Add space…")}
            description={
              draft.scope === "workspace"
                ? t("Leave empty to include all accessible spaces.")
                : undefined
            }
            scopes={[
              { value: "current", label: t("Current space") },
              { value: "workspace", label: t("All accessible spaces") },
            ]}
            value={selectedSpaces}
            onChange={changeSpaces}
            // A scope can still replace a full list of named spaces.
            maxValues={PAGES_BY_LABEL_MAX_FILTERS + 1}
            unavailableLabel={t("Unavailable space")}
            withinPortal={false}
          />
          <Checkbox
            label={t("Exclude the current page")}
            checked={draft.excludeCurrentPage}
            onChange={(e) =>
              update("excludeCurrentPage", e.currentTarget.checked)
            }
          />
        </>
      }
      display={
        <>
          <TextInput
            label={
              <Group component="span" justify="space-between" gap="xs">
                {t("Heading")}
                <Text component="span" size="sm" c="dimmed" aria-hidden>
                  {t("Optional")}
                </Text>
              </Group>
            }
            labelProps={{ w: "100%" }}
            value={draft.heading}
            maxLength={PAGES_BY_LABEL_MAX_HEADING_LENGTH}
            onChange={(e) => update("heading", e.currentTarget.value)}
          />
          <SimpleGrid cols={{ base: 1, xs: 2 }}>
            <Select
              label={t("Sort by")}
              allowDeselect={false}
              value={draft.sortBy}
              description={savedOrderHint}
              inputWrapperOrder={["label", "input", "description", "error"]}
              data={[
                { value: "title", label: t("Title") },
                { value: "updatedAt", label: t("Last updated") },
                { value: "createdAt", label: t("Date created") },
              ]}
              onChange={(value) => {
                if (!value || value === draft.sortBy) return;
                setDraft((previous) => ({
                  ...previous,
                  sortBy: value as PagesByLabelAttributes["sortBy"],
                  sortDirection: value === "title" ? "asc" : "desc",
                }));
              }}
              comboboxProps={{ withinPortal: false }}
            />
            <PageListLimitInput
              max={PAGES_BY_LABEL_MAX_LIMIT}
              value={limit}
              onChange={setLimit}
            />
          </SimpleGrid>
          <fieldset className={classes.rowOptions}>
            <legend>{t("Show on each row")}</legend>
            <Group gap="lg">
              <Checkbox
                label={t("Labels")}
                checked={draft.showLabels}
                onChange={(e) => update("showLabels", e.currentTarget.checked)}
              />
              <Checkbox
                label={t("Space name")}
                checked={draft.showSpace}
                onChange={(e) => update("showSpace", e.currentTarget.checked)}
              />
            </Group>
          </fieldset>
        </>
      }
    />
  );
}
