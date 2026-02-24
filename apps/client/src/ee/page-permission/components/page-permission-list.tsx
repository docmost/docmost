import { Center, Group, Loader, ScrollArea, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { modals } from "@mantine/modals";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { PagePermissionRole } from "@/ee/page-permission/types/page-permission.types";
import {
  usePagePermissionsQuery,
  useRemovePagePermissionMutation,
  useUpdatePagePermissionRoleMutation,
} from "@/ee/page-permission/queries/page-permission-query";
import { PagePermissionItem } from "@/ee/page-permission";
import classes from "./page-permission.module.css";

type PagePermissionListProps = {
  pageId: string;
  canManage: boolean;
  onRemoveAll?: () => void;
};

export function PagePermissionList({
  pageId,
  canManage,
  onRemoveAll,
}: PagePermissionListProps) {
  const { t } = useTranslation();
  const currentUser = useAtomValue(userAtom);
  const updateRoleMutation = useUpdatePagePermissionRoleMutation();
  const removeMutation = useRemovePagePermissionMutation();

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    usePagePermissionsQuery(pageId);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: viewportRef.current, threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRoleChange = async (
    memberId: string,
    type: "user" | "group",
    newRole: string,
  ) => {
    await updateRoleMutation.mutateAsync({
      pageId,
      role: newRole as PagePermissionRole,
      ...(type === "user" ? { userId: memberId } : { groupId: memberId }),
    });
  };

  const handleRemove = (memberId: string, type: "user" | "group") => {
    modals.openConfirmModal({
      title: t("Remove access"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to remove this member's access to the page?",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Remove"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        await removeMutation.mutateAsync({
          pageId,
          ...(type === "user"
            ? { userIds: [memberId] }
            : { groupIds: [memberId] }),
        });
      },
    });
  };

  const handleRemoveAll = () => {
    modals.openConfirmModal({
      title: t("Remove all access"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to remove all specific access? This will make the page open to everyone in the space.",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Remove all"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => onRemoveAll?.(),
    });
  };

  const members = data?.pages.flatMap((page) => page.items) ?? [];

  const sortedMembers = [...members].sort((a, b) => {
    if (a.type === "user" && a.id === currentUser?.id) return -1;
    if (b.type === "user" && b.id === currentUser?.id) return 1;
    if (a.type === "group" && b.type === "user") return -1;
    if (a.type === "user" && b.type === "group") return 1;
    return 0;
  });

  if (isLoading) {
    return (
      <Center py="md">
        <Loader size="sm" />
      </Center>
    );
  }

  if (members.length === 0) {
    return null;
  }

  return (
    <>
      <Group justify="space-between" align="center">
        <Text size="sm" fw={500}>
          {t("People with access")}
        </Text>
        {canManage && members.length > 0 && (
          <Text className={classes.removeAllLink} onClick={handleRemoveAll}>
            {t("Remove all")}
          </Text>
        )}
      </Group>

      <ScrollArea mah={250} viewportRef={viewportRef}>
        {sortedMembers.map((member) => (
          <PagePermissionItem
            key={`${member.type}-${member.id}`}
            member={member}
            onRoleChange={handleRoleChange}
            onRemove={handleRemove}
            disabled={!canManage}
          />
        ))}

        <div ref={sentinelRef} style={{ height: 1 }} />

        {isFetchingNextPage && (
          <Center py="xs">
            <Loader size="xs" />
          </Center>
        )}
      </ScrollArea>
    </>
  );
}
