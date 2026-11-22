import {
  Accordion,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
} from "@mantine/core";
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
import { SpaceSelect } from "@/features/space/components/sidebar/space-select";
import classes from "./pages-by-label.module.css";

const labelLimits = {
  maxValues: PAGES_BY_LABEL_MAX_FILTERS,
  isWithinLength: (name: string) =>
    [...name].length <= PAGES_BY_LABEL_MAX_LABEL_LENGTH,
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
    draft.scope === "spaces" ? draft.spaceIds : [draft.scope];
  function changeSpaces(values: string[]) {
    const last = values.at(-1);
    const scope = last === "current" || last === "workspace" ? last : "spaces";
    const spaceIds =
      scope === "spaces"
        ? values.filter((id) => id !== "current" && id !== "workspace")
        : [];
    if (spaceIds.length <= PAGES_BY_LABEL_MAX_FILTERS) {
      setDraft((previous) => ({ ...previous, scope, spaceIds }));
    }
  }
  const excludedLabels = (
    <LabelFilter
      {...labelLimits}
      label={t("Exclude labels")}
      value={draft.excludeLabels}
      onChange={(labels) => update("excludeLabels", labels)}
    />
  );
  const hasSavedExclusions = initial.excludeLabels.length > 0;
  const defaultSortDirection = draft.sortBy === "title" ? "asc" : "desc";
  const savedOrderHint =
    draft.sortDirection === defaultSortDirection
      ? undefined
      : draft.sortBy === "title"
        ? t("Reverse alphabetical order")
        : t("Oldest first");
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
        const changes = Object.fromEntries(
          Object.entries(options).filter(
            ([key, value]) =>
              JSON.stringify(value) !== JSON.stringify(initial[key]),
          ),
        );
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
        {hasSavedExclusions && excludedLabels}
        <SpaceSelect
          multiple
          label={t("Search in")}
          placeholder={t("Search for spaces")}
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
        <Accordion
          variant="filled"
          chevronPosition="left"
          classNames={{ chevron: classes.optionsChevron }}
          keepMounted={false}
        >
          <Accordion.Item value="options">
            <Accordion.Control>{t("More options")}</Accordion.Control>
            <Accordion.Panel>
              <Stack>
                {!hasSavedExclusions && excludedLabels}
                <SimpleGrid cols={{ base: 1, xs: 2 }}>
                  <Select
                    label={t("Sort by")}
                    allowDeselect={false}
                    value={draft.sortBy}
                    description={savedOrderHint}
                    inputWrapperOrder={[
                      "label",
                      "input",
                      "description",
                      "error",
                    ]}
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
                    onChange={(e) =>
                      update("showLabels", e.currentTarget.checked)
                    }
                  />
                  <Checkbox
                    label={t("Show space name")}
                    checked={draft.showSpace}
                    onChange={(e) =>
                      update("showSpace", e.currentTarget.checked)
                    }
                  />
                  <Checkbox
                    label={t("Exclude this page")}
                    checked={draft.excludeCurrentPage}
                    onChange={(e) =>
                      update("excludeCurrentPage", e.currentTarget.checked)
                    }
                  />
                </Group>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
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
