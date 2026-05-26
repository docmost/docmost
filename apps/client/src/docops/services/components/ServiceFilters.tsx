import { Group, Select, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconSearch } from "@tabler/icons-react";
import type { LifecycleState, ListServicesParams } from "../types/service.types";
import { useTagsQuery } from "../hooks/useServices";

interface ServiceFiltersProps {
  value: ListServicesParams;
  onChange: (params: ListServicesParams) => void;
}

export function ServiceFilters({ value, onChange }: ServiceFiltersProps) {
  const { t } = useTranslation();
  const { data: tagsData } = useTagsQuery();
  const [searchInput, setSearchInput] = useState(value.search ?? "");
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    onChange({ ...value, search: debouncedSearch || undefined, offset: 0 });
  }, [debouncedSearch]);

  return (
    <Group gap="sm" mb="md" wrap="wrap">
      <TextInput
        placeholder={t("Search services...")}
        leftSection={<IconSearch size={14} />}
        value={searchInput}
        onChange={(e) => setSearchInput(e.currentTarget.value)}
        w={220}
        size="sm"
        aria-label={t("Search services")}
      />

      <Select
        placeholder={t("Status")}
        clearable
        size="sm"
        w={150}
        data={[
          { value: "active", label: t("active") },
          { value: "deprecated", label: t("deprecated") },
          { value: "retired", label: t("retired") },
        ]}
        value={value.lifecycleState ?? null}
        onChange={(v) =>
          onChange({
            ...value,
            lifecycleState: (v as LifecycleState) ?? undefined,
            offset: 0,
          })
        }
        aria-label={t("Filter by status")}
      />

      {tagsData && tagsData.length > 0 && (
        <Select
          placeholder={t("Tag")}
          clearable
          size="sm"
          w={160}
          data={tagsData.map((t) => ({ value: t.name, label: t.name }))}
          value={value.tag ?? null}
          onChange={(v) =>
            onChange({ ...value, tag: v ?? undefined, offset: 0 })
          }
          aria-label={t("Filter by tag")}
        />
      )}
    </Group>
  );
}
