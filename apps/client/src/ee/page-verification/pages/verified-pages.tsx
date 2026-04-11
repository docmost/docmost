import { useState, useMemo } from "react";
import { Group, MultiSelect, Select, Space, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { IconSearch } from "@tabler/icons-react";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppName } from "@/lib/config";
import Paginate from "@/components/common/paginate";
import { useCursorPaginate } from "@/hooks/use-cursor-paginate";
import { useVerificationListQuery } from "@/ee/page-verification/queries/page-verification-query";
import { IVerificationListParams } from "@/ee/page-verification/types/page-verification.types";
import VerificationListTable from "@/ee/page-verification/components/verification-list-table";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";

export default function VerifiedPages() {
  const { t } = useTranslation();
  const { cursor, goNext, goPrev, resetCursor } = useCursorPaginate();

  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);
  const [spaceFilter, setSpaceFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const { data: spacesData } = useGetSpacesQuery({ limit: 100 });

  const spaceOptions = useMemo(
    () =>
      spacesData?.items?.map((space) => ({
        value: space.id,
        label: space.name,
      })) ?? [],
    [spacesData],
  );

  const typeOptions = [
    { value: "expiring", label: t("Expiring") },
    { value: "qms", label: t("QMS") },
  ];

  const params: IVerificationListParams = useMemo(
    () => ({
      cursor,
      limit: 50,
      spaceIds: spaceFilter.length > 0 ? spaceFilter : undefined,
      type: typeFilter as IVerificationListParams["type"],
      query: debouncedSearch || undefined,
    }),
    [cursor, spaceFilter, typeFilter, debouncedSearch],
  );

  const { data, isLoading } = useVerificationListQuery(params);

  const handleSpaceChange = (value: string[]) => {
    setSpaceFilter(value);
    resetCursor();
  };

  const handleTypeChange = (value: string | null) => {
    setTypeFilter(value);
    resetCursor();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.currentTarget.value);
    resetCursor();
  };

  return (
    <>
      <Helmet>
        <title>
          {t("Verified pages")} - {getAppName()}
        </title>
      </Helmet>

      <SettingsTitle title={t("Verified pages")} />

      <Group mb="md" gap="sm">
        <TextInput
          placeholder={t("Search by title")}
          leftSection={<IconSearch size={16} />}
          value={searchValue}
          onChange={handleSearchChange}
          size="sm"
          w={220}
        />

        {/*
        <MultiSelect
          placeholder={t("Filter by space")}
          data={spaceOptions}
          value={spaceFilter}
          onChange={handleSpaceChange}
          clearable
          searchable
          w={220}
          size="sm"
        />

        <Select
          placeholder={t("Filter by type")}
          data={typeOptions}
          value={typeFilter}
          onChange={handleTypeChange}
          clearable
          w={160}
          size="sm"
        />
        */}
      </Group>

      <VerificationListTable items={data?.items} isLoading={isLoading} />

      <Space h="md" />

      {data?.items && data.items.length > 0 && (
        <Paginate
          hasPrevPage={data?.meta?.hasPrevPage}
          hasNextPage={data?.meta?.hasNextPage}
          onNext={() => goNext(data?.meta?.nextCursor)}
          onPrev={goPrev}
        />
      )}
    </>
  );
}
