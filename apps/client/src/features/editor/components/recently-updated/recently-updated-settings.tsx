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
import {
  getPageListSettingsChanges,
  PageListFilterGroup,
  PageListLabelFilters,
  PageListLimitInput,
  PageListSettingsModal,
} from "../common/page-list-settings";

export default function RecentlyUpdatedSettings({
  initial,
  onSave,
  onClose,
}: {
  initial: RecentlyUpdatedAttributes;
  onSave: (changes: Partial<RecentlyUpdatedAttributes>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const editorSpaceId = useContext(EditorSpaceContext);
  const { spaceSlug } = useParams();
  const spaceKey = editorSpaceId ?? spaceSlug;
  const { data: currentSpace, isLoading } = useGetSpaceBySlugQuery(spaceKey);
  const [draft, setDraft] = useState(initial);
  const [limit, setLimit] = useState<string | number>(initial.limit);
  const validLimit =
    typeof limit === "number" &&
    Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= MAX_RECENTLY_UPDATED_LIMIT;

  const spacePicker = {
    multiple: true as const,
    withinPortal: false,
    maxValues: RECENTLY_UPDATED_FILTER_LIMITS.maxValues,
    unavailableLabel: t("Unavailable space"),
    scopes: currentSpace
      ? [
          {
            value: currentSpace.id,
            label: currentSpace.name,
            logo: currentSpace.logo,
          },
        ]
      : [],
  };
  return (
    <PageListSettingsModal
      title={t("Recently updated")}
      description={t("List pages by most recent edit.")}
      canSave={validLimit}
      onClose={onClose}
      onSave={() => {
        const changes = getPageListSettingsChanges(initial, {
          ...draft,
          limit: normalizeRecentlyUpdatedLimit(limit),
        });
        // A change to the space selection replaces both parts of that filter.
        if ("scope" in changes || "spaceIds" in changes) {
          changes.scope = draft.scope;
          changes.spaceIds = draft.spaceIds;
        }
        onSave(changes);
      }}
      primaryFilter={
        <PageListFilterGroup
          label={t("Spaces")}
          labelAction={
            <Checkbox
              size="xs"
              label={t("All accessible spaces")}
              checked={draft.scope === "workspace"}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  scope: event.currentTarget.checked ? "workspace" : "current",
                  spaceIds: [],
                })
              }
            />
          }
          hint={
            draft.scope === "spaces" && !draft.spaceIds.length
              ? t("Choose a space to show pages.")
              : draft.scope === "workspace"
                ? t(
                    "This list shows pages from all accessible spaces except those you exclude.",
                  )
                : t("Leave empty to use the space containing this block.")
          }
          excludeLabel={t("Exclude spaces")}
          hasExclusions={draft.excludeSpaceIds.length > 0}
          renderIncluded={(field) => (
            <SpaceSelect
              {...spacePicker}
              {...field}
              disabled={draft.scope === "workspace"}
              placeholderSpace={
                draft.scope === "current" ? currentSpace : undefined
              }
              placeholder={
                draft.scope !== "current"
                  ? t("Add space…")
                  : isLoading
                    ? t("Loading…")
                    : t("Space where this block is used")
              }
              value={draft.spaceIds}
              onChange={(spaceIds) =>
                setDraft({
                  ...draft,
                  scope: spaceIds.length ? "spaces" : "current",
                  spaceIds,
                })
              }
            />
          )}
          renderExcluded={(field) => (
            <SpaceSelect
              {...spacePicker}
              {...field}
              placeholder={t("Add space…")}
              value={draft.excludeSpaceIds}
              onChange={(excludeSpaceIds) =>
                setDraft({ ...draft, excludeSpaceIds })
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
