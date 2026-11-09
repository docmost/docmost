import { useEffect, useMemo, useState } from "react";
import { Button, Group, MultiSelect, Select, Stack, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  collaborationPost,
  Member,
  ResultPage,
  useCollaborationIdentity,
} from "./collaboration-api";

export function MemberPicker({
  pageId,
  multiple,
  value,
  onChange,
  initialMembers = [],
}: {
  pageId: string;
  multiple?: boolean;
  value: string[];
  onChange: (ids: string[]) => void;
  initialMembers?: Member[];
}) {
  const { workspaceId, userId } = useCollaborationIdentity();
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 250);
  const [known, setKnown] = useState<Member[]>(initialMembers);
  const query = useInfiniteQuery({
    queryKey: [
      "document-collaboration",
      workspaceId,
      userId,
      "members",
      pageId,
      debounced,
    ],
    queryFn: ({ pageParam }) =>
      collaborationPost<ResultPage<Member>>("members", {
        pageId,
        query: debounced,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor || undefined,
    enabled: !!pageId && !!workspaceId,
  });
  const members = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) || [],
    [query.data],
  );
  useEffect(() => {
    setKnown((old) => [
      ...new Map([...old, ...members].map((m) => [m.id, m])).values(),
    ]);
  }, [members]);
  const options = [
    ...new Map(
      [...members, ...known.filter((m) => value.includes(m.id))].map((m) => [
        m.id,
        m,
      ]),
    ).values(),
  ].map((m) => ({
    value: m.id,
    label: m.email
      ? `${m.name || "未命名成员"}（${m.email}）`
      : m.name || "未命名成员",
  }));
  const common = {
    label: multiple ? "接收人" : "负责人",
    placeholder: "搜索有文档读取权限的成员",
    searchable: true,
    searchValue: search,
    onSearchChange: setSearch,
    data: options,
    required: true,
    nothingFoundMessage: query.isPending ? "加载中…" : "没有匹配的可访问成员",
  };
  return (
    <Stack gap={4}>
      {multiple ? (
        <MultiSelect
          {...common}
          value={value}
          onChange={onChange}
          maxValues={100}
        />
      ) : (
        <Select
          {...common}
          value={value[0] || null}
          onChange={(id) => onChange(id ? [id] : [])}
        />
      )}
      {query.isError && (
        <Text c="red" size="sm">
          成员加载失败，请重试或检查文档编辑权限。
        </Text>
      )}
      {query.hasNextPage && (
        <Group>
          <Button
            variant="subtle"
            size="xs"
            onClick={() => query.fetchNextPage()}
            loading={query.isFetchingNextPage}
          >
            继续查找成员
          </Button>
        </Group>
      )}
    </Stack>
  );
}
