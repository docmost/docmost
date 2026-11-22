import {
  Anchor,
  Button,
  Checkbox,
  Divider,
  Group,
  Input,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
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
import { IconPlus } from "@tabler/icons-react";
import { useId, useState } from "react";
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
  const id = useId();
  const [draft, setDraft] = useState(initial);
  const [addingExclusions, setAddingExclusions] = useState(false);
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
  const showExclusions = initial.excludeLabels.length > 0 || addingExclusions;
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
      className={classes.form}
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
      <Text size="sm" c="dimmed" mb="lg">
        {t("Insert a list of pages that share labels.")}
      </Text>

      <Stack component="section" gap="md" aria-labelledby={id + "-find"}>
        <h3 id={id + "-find"} className={classes.sectionTitle}>
          {t("Find pages")}
        </h3>
        <Stack gap={6}>
          <Group justify="space-between" gap="xs">
            <Input.Label htmlFor={id + "-labels"}>{t("Labels")}</Input.Label>
            <LabelMatchSelect
              inline
              value={draft.match}
              onChange={(match) => update("match", match)}
            />
          </Group>
          <LabelFilter
            {...labelLimits}
            id={id + "-labels"}
            className={classes.labelFilter}
            description={
              <Group component="span" justify="space-between" gap="xs" mt={6}>
                <Text component="span" aria-live="polite" size="sm" c="dimmed">
                  {draft.match === "all"
                    ? t("Pages need all of these labels.")
                    : t("Pages need at least one of these labels.")}
                </Text>
                {!showExclusions && (
                  <Anchor
                    component="button"
                    type="button"
                    size="sm"
                    className={classes.addExclusion}
                    onClick={() => setAddingExclusions(true)}
                  >
                    <IconPlus size={14} aria-hidden />
                    {t("Exclude labels")}
                  </Anchor>
                )}
              </Group>
            }
            placeholder={t("Add label…")}
            required
            value={draft.labels}
            onChange={(labels) => update("labels", labels)}
          />
        </Stack>
        {showExclusions && (
          <LabelFilter
            {...labelLimits}
            className={classes.labelFilter}
            label={t("Exclude labels")}
            placeholder={t("Add label…")}
            autoFocus={addingExclusions}
            value={draft.excludeLabels}
            onChange={(labels) => update("excludeLabels", labels)}
          />
        )}
        <SpaceSelect
          multiple
          label={t("Spaces")}
          placeholder={t("Add space…")}
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
      </Stack>

      <Divider my="lg" />

      <Stack component="section" gap="md" aria-labelledby={id + "-display"}>
        <h3 id={id + "-display"} className={classes.sectionTitle}>
          {t("Display")}
        </h3>
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
          <NumberInput<number>
            label={t("Show up to")}
            min={1}
            max={PAGES_BY_LABEL_MAX_LIMIT}
            allowDecimal={false}
            value={limit}
            onChange={setLimit}
            description={t("pages")}
            inputWrapperOrder={["label", "input", "description", "error"]}
            classNames={{
              root: classes.limitField,
              description: classes.limitUnit,
            }}
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
      </Stack>

      <Group justify="flex-end" gap="xs" className={classes.actions}>
        <Button type="button" variant="default" onClick={onClose}>
          {t("Cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {t("Save")}
        </Button>
      </Group>
    </form>
  );
}
