import { useState } from "react";
import {
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import {
  MAX_RECENTLY_UPDATED_LIMIT,
  RECENTLY_UPDATED_FILTER_LIMITS,
  decodeRecentlyUpdatedLabel,
  encodeRecentlyUpdatedLabel,
  normalizeRecentlyUpdatedLimit,
  type RecentlyUpdatedAttributes,
} from "@docmost/editor-ext";
import { useWorkspaceLabelsQuery } from "@/features/label/queries/label-query";
import { SpaceSelect } from "@/features/space/components/sidebar/space-select";

function filterOperator(value: string) {
  return value.match(/^[+-]/)?.[0] ?? "";
}

export default function RecentlyUpdatedSettings({
  options,
  onSave,
}: {
  options: RecentlyUpdatedAttributes;
  onSave: (options: RecentlyUpdatedAttributes) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(options);
  const [limit, setLimit] = useState<string | number>(options.limit);
  const [labelSearch, setLabelSearch] = useState("");
  const prefix = filterOperator(labelSearch);
  const searchTerm = labelSearch.slice(prefix.length).trim();
  const [labelQuery] = useDebouncedValue(searchTerm, 250);
  const { data: labels } = useWorkspaceLabelsQuery(labelQuery, true);
  const labelChoices = new Map(
    draft.labels.map((token) => {
      const sign = filterOperator(token);
      return [
        token,
        sign + decodeRecentlyUpdatedLabel(token.slice(sign.length)),
      ];
    }),
  );
  for (const { name } of labels?.items ?? []) {
    labelChoices.set(prefix + encodeRecentlyUpdatedLabel(name), prefix + name);
  }
  const spaceScopes = [
    { value: "@self", label: t("Current space") },
    { value: "@all", label: t("All spaces") },
    { value: "@personal", label: t("Personal spaces") },
    { value: "@global", label: t("Non-personal spaces") },
    { value: "@favorite", label: t("Favorite spaces") },
  ];
  return (
    <Stack>
      <NumberInput<number>
        label={t("Maximum results")}
        min={1}
        max={MAX_RECENTLY_UPDATED_LIMIT}
        allowDecimal={false}
        value={limit}
        onChange={setLimit}
      />
      <Switch
        label={t("Show heading")}
        checked={!draft.hideHeading}
        onChange={(event) =>
          setDraft({ ...draft, hideHeading: !event.currentTarget.checked })
        }
      />
      <Text c="dimmed" size="sm">
        {t("Start a search with + to require a match or - to exclude it.")}
      </Text>
      <SpaceSelect
        multiple
        withOperators
        label={t("Spaces")}
        placeholder={t("Current space")}
        value={draft.spaces}
        onChange={(spaces) => setDraft({ ...draft, spaces })}
        scopes={spaceScopes}
        maxValues={RECENTLY_UPDATED_FILTER_LIMITS.maxValues}
        withinPortal={false}
      />
      <MultiSelect
        label={t("Labels")}
        searchable
        hidePickedOptions
        data={Array.from(labelChoices, ([value, label]) => ({ value, label }))}
        value={draft.labels}
        onChange={(labels) => setDraft({ ...draft, labels })}
        searchValue={labelSearch}
        onSearchChange={setLabelSearch}
        filter={({ options }) =>
          options.filter(
            (option) =>
              "label" in option &&
              option.label.toLowerCase().includes(searchTerm.toLowerCase()),
          )
        }
        maxValues={RECENTLY_UPDATED_FILTER_LIMITS.maxValues}
        comboboxProps={{ withinPortal: false }}
      />
      <Group justify="flex-end">
        <Button
          onClick={() =>
            onSave({ ...draft, limit: normalizeRecentlyUpdatedLimit(limit) })
          }
        >
          {t("Save")}
        </Button>
      </Group>
    </Stack>
  );
}
