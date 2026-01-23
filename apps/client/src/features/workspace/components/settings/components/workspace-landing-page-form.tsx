import { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { Button, Select, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { searchSuggestions } from "@/features/search/services/search-service.ts";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { getRecentChanges } from "@/features/page/services/page-service.ts";

type LandingPageSelectItem = {
  value: string;
  label: string;
  pageId: string;
  spaceName?: string;
};

export default function WorkspaceLandingPageForm() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const { isAdmin } = useUserRole();

  const [value, setValue] = useState<string | null>(workspace?.landingPageId ?? null);
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchQuery, 250);
  const [options, setOptions] = useState<any[]>([]);
  const [recentOptions, setRecentOptions] = useState<any[]>([]);
  const [selectedOption, setSelectedOption] = useState<LandingPageSelectItem | null>(
    null,
  );

  const landingPageId = workspace?.landingPageId ?? null;
  const { data: landingPage } = usePageQuery({
    pageId: landingPageId ?? undefined,
  });

  useEffect(() => {
    setValue(workspace?.landingPageId ?? null);
  }, [workspace?.landingPageId]);

  useEffect(() => {
    if (landingPage && landingPage.id) {
      setSelectedOption({
        value: landingPage.id,
        pageId: landingPage.id,
        label: `${landingPage.icon || ""} ${landingPage.title || t("untitled")}`.trim(),
        spaceName: landingPage.space?.name,
      });
    } else if (!landingPageId) {
      setSelectedOption(null);
    }
  }, [landingPageId, landingPage, t]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const q = debouncedQuery.trim();
      if (q.length < 1) {
        setOptions([]);
        return;
      }
      try {
        const results = await searchSuggestions({
          query: q,
          includePages: true,
          limit: 15,
        });
        if (!cancelled) setOptions(results?.pages || []);
      } catch {
        if (!cancelled) setOptions([]);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const recent = await getRecentChanges(undefined, { page: 1, limit: 10 });
        if (!cancelled) setRecentOptions(recent?.items ?? []);
      } catch {
        if (!cancelled) setRecentOptions([]);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const { data, itemsByValue } = useMemo(() => {
    const showRecent = searchQuery.trim().length === 0;
    const raw = showRecent
      ? Array.isArray(recentOptions)
        ? recentOptions
        : []
      : Array.isArray(options)
        ? options
        : [];

    const items: LandingPageSelectItem[] = raw.map((p) => ({
      value: p.id,
      pageId: p.id,
      label: `${p.icon || ""} ${p.title || t("untitled")}`.trim(),
      spaceName: p.space?.name,
    }));

    if (selectedOption && !items.find((i) => i.value === selectedOption.value)) {
      items.unshift(selectedOption);
    }

    const groupedData = showRecent
      ? [
          {
            group: t("Recent pages"),
            items: items.map(({ value, label, spaceName }) => ({
              value,
              label: spaceName ? `${label} — ${spaceName}` : label,
            })),
          },
        ]
      : (() => {
          const grouped = new Map<string, LandingPageSelectItem[]>();
          for (const item of items) {
            const groupName = item.spaceName || t("Unknown space");
            const bucket = grouped.get(groupName) ?? [];
            bucket.push(item);
            grouped.set(groupName, bucket);
          }
          return Array.from(grouped.entries()).map(([group, groupItems]) => ({
            group,
            items: groupItems.map(({ value, label }) => ({ value, label })),
          }));
        })();

    const byValue = new Map<string, LandingPageSelectItem>();
    for (const item of items) byValue.set(item.value, item);

    return { data: groupedData, itemsByValue: byValue };
  }, [options, recentOptions, searchQuery, selectedOption, t]);

  async function handleSave() {
    setIsLoading(true);
    try {
      const updated = await updateWorkspace({ landingPageId: value || null });
      setWorkspace(updated);
      notifications.show({ message: t("Updated successfully") });
    } catch (err) {
      console.log(err);
      notifications.show({ message: t("Failed to update data"), color: "red" });
    } finally {
      setIsLoading(false);
    }
  }

  const isDirty = (workspace?.landingPageId ?? null) !== value;

  const nothingFoundMessage =
    searchQuery.trim().length === 0 ? t("Type to search pages...") : t("No results found...");

  return (
    <div style={{ marginTop: 24 }}>
      <Text size="sm" fw={500} mb="xs">
        {t("Landing page")}
      </Text>
      <Select
        placeholder={t("Optional")}
        searchable
        clearable
        nothingFoundMessage={nothingFoundMessage}
        variant="filled"
        value={value}
        onChange={(next) => {
          setValue(next);
          if (!next) {
            setSelectedOption(null);
            return;
          }
          const found = itemsByValue.get(next);
          if (found) setSelectedOption(found);
        }}
        onSearchChange={setSearchQuery}
        data={data}
        disabled={!isAdmin}
        description={t(
          "If set, members will be redirected here when opening the workspace.",
        )}
      />

      {isAdmin && (
        <Button
          mt="sm"
          type="button"
          disabled={isLoading || !isDirty}
          loading={isLoading}
          onClick={handleSave}
        >
          {t("Save")}
        </Button>
      )}
    </div>
  );
}

