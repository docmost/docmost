import { useContext, useState } from "react";
import { Checkbox } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import {
  MAX_RECENTLY_UPDATED_LIMIT,
  RECENTLY_UPDATED_FILTER_LIMITS,
  normalizeRecentlyUpdatedLimit,
  recentlyUpdatedFilterValueWithinLimit,
  type RecentlyUpdatedAttributes,
} from "@docmost/editor-ext";
import { SpaceSelect } from "@/features/space/components/sidebar/space-select";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import { EditorSpaceContext } from "./editor-space-context";
import { PagesByLabelContext } from "../pages-by-label/pages-by-label-context";
import {
  PageListFilterGroup,
  PageListLabelFilters,
  PageListLimitInput,
  PageListSettingsModal,
} from "../common/page-list-settings";

export default function RecentlyUpdatedSettings({
  options,
  onSave,
  onClose,
}: {
  options: RecentlyUpdatedAttributes;
  onSave: (options: RecentlyUpdatedAttributes) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const pageContext = useContext(PagesByLabelContext);
  const editorSpaceId = useContext(EditorSpaceContext) ?? pageContext?.spaceId;
  const { spaceSlug } = useParams();
  const spaceKey = editorSpaceId ?? spaceSlug;
  const { data: currentSpace, isLoading } = useGetSpaceBySlugQuery(spaceKey);
  const [draft, setDraft] = useState(options);
  const [limit, setLimit] = useState<string | number>(options.limit);
  const validLimit =
    typeof limit === "number" &&
    Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= MAX_RECENTLY_UPDATED_LIMIT;

  const spacePicker = {
    multiple: true as const,
    withinPortal: false,
    maxValues: RECENTLY_UPDATED_FILTER_LIMITS.maxValues,
    scopes: [
      {
        value: "@self",
        spaceId: currentSpace?.id ?? editorSpaceId,
        logo: currentSpace?.logo,
        label:
          currentSpace?.name ??
          (!spaceKey
            ? t("Space where this block is used")
            : isLoading
              ? t("Loading…")
              : t("Unavailable space")),
      },
      { value: "@all", label: t("All spaces") },
      { value: "@personal", label: t("Personal spaces") },
      { value: "@global", label: t("Non-personal spaces") },
      { value: "@favorite", label: t("Favorite spaces") },
    ],
  };
  return (
    <PageListSettingsModal
      title={t("Recently updated")}
      description={t("List pages by most recent edit.")}
      canSave={validLimit}
      onClose={onClose}
      onSave={() =>
        onSave({ ...draft, limit: normalizeRecentlyUpdatedLimit(limit) })
      }
      primaryFilter={
        <PageListFilterGroup
          label={t("Spaces")}
          matchLabel={t("Space matching")}
          showMatch={draft.spaces.length > 1}
          match={draft.spaceMatch}
          onMatchChange={(spaceMatch) => setDraft({ ...draft, spaceMatch })}
          hint={
            draft.spaces.length
              ? draft.spaceMatch === "all"
                ? t("Pages must match every selected space filter.")
                : t("Pages can match any selected space filter.")
              : draft.excludeSpaces.length
                ? t(
                    "This list shows pages from all accessible spaces except those you exclude.",
                  )
                : t("Leave empty to include all accessible spaces.")
          }
          excludeLabel={t("Exclude spaces")}
          hasExclusions={draft.excludeSpaces.length > 0}
          renderIncluded={(field) => (
            <SpaceSelect
              {...spacePicker}
              {...field}
              placeholder={t("Add space…")}
              value={draft.spaces}
              onChange={(spaces) => setDraft({ ...draft, spaces })}
            />
          )}
          renderExcluded={(field) => (
            <SpaceSelect
              {...spacePicker}
              {...field}
              placeholder={t("Add space…")}
              value={draft.excludeSpaces}
              onChange={(excludeSpaces) =>
                setDraft({ ...draft, excludeSpaces })
              }
            />
          )}
        />
      }
      filters={
        <PageListLabelFilters
          maxValues={RECENTLY_UPDATED_FILTER_LIMITS.maxValues}
          isWithinLength={recentlyUpdatedFilterValueWithinLimit}
          labels={draft.labels}
          excludeLabels={draft.excludeLabels}
          match={draft.match}
          onLabelsChange={(labels) => setDraft({ ...draft, labels })}
          onExcludeLabelsChange={(excludeLabels) =>
            setDraft({ ...draft, excludeLabels })
          }
          onMatchChange={(match) => setDraft({ ...draft, match })}
        />
      }
      display={
        <>
          <PageListLimitInput
            max={MAX_RECENTLY_UPDATED_LIMIT}
            value={limit}
            onChange={setLimit}
          />
          <Checkbox
            label={t("Show heading")}
            checked={!draft.hideHeading}
            onChange={(event) =>
              setDraft({ ...draft, hideHeading: !event.currentTarget.checked })
            }
          />
        </>
      }
    />
  );
}
