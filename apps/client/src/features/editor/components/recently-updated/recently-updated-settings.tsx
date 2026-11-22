import { useState } from "react";
import { Button, Group, NumberInput, Stack, Switch, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  MAX_RECENTLY_UPDATED_LIMIT,
  RECENTLY_UPDATED_FILTER_LIMITS,
  normalizeRecentlyUpdatedLimit,
  recentlyUpdatedFilterValueWithinLimit,
  type RecentlyUpdatedAttributes,
} from "@docmost/editor-ext";
import {
  LabelFilter,
  LabelMatchSelect,
} from "@/features/label/components/label-filter";
import { SpaceSelect } from "@/features/space/components/sidebar/space-select";

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
        {t(
          "Tip: Start a space search with + to require a match or - to exclude it.",
        )}
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
      <LabelFilter
        label={t("Include labels")}
        maxValues={RECENTLY_UPDATED_FILTER_LIMITS.maxValues}
        isWithinLength={recentlyUpdatedFilterValueWithinLimit}
        value={draft.labels}
        onChange={(labels) => setDraft({ ...draft, labels })}
      />
      {draft.labels.length > 1 && (
        <LabelMatchSelect
          value={draft.match}
          onChange={(match) => setDraft({ ...draft, match })}
        />
      )}
      <LabelFilter
        label={t("Exclude labels")}
        maxValues={RECENTLY_UPDATED_FILTER_LIMITS.maxValues}
        isWithinLength={recentlyUpdatedFilterValueWithinLimit}
        value={draft.excludeLabels}
        onChange={(excludeLabels) => setDraft({ ...draft, excludeLabels })}
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
