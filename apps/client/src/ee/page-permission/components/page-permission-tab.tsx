import { useState } from "react";
import { Button, Divider, Group, Loader, Select, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { IconArrowRight } from "@tabler/icons-react";
import { MultiMemberSelect } from "@/features/space/components/multi-member-select";
import {
  IPageRestrictionInfo,
  PagePermissionRole,
} from "@/ee/page-permission/types/page-permission.types";
import {
  useAddPagePermissionMutation,
  usePagePermissionsQuery,
  useRestrictPageMutation,
  useUnrestrictPageMutation,
} from "@/ee/page-permission/queries/page-permission-query";
import { pagePermissionRoleData } from "@/ee/page-permission/types/page-permission-role-data";
import { GeneralAccessSelect } from "./general-access-select";
import { PagePermissionList } from "./page-permission-list";
import classes from "./page-permission.module.css";
import { buildPageUrl } from "@/features/page/page.utils";

type PagePermissionTabProps = {
  pageId: string;
  restrictionInfo: IPageRestrictionInfo;
};

export function PagePermissionTab({
  pageId,
  restrictionInfo,
}: PagePermissionTabProps) {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [role, setRole] = useState<string>(PagePermissionRole.WRITER);

  const { data: permissionsData, isLoading } = usePagePermissionsQuery(pageId);
  const restrictMutation = useRestrictPageMutation();
  const unrestrictMutation = useUnrestrictPageMutation();
  const addPermissionMutation = useAddPagePermissionMutation();

  const isRestricted =
    restrictionInfo.hasDirectRestriction ||
    restrictionInfo.hasInheritedRestriction;
  const isInherited =
    restrictionInfo.hasInheritedRestriction &&
    !restrictionInfo.hasDirectRestriction;
  const canManage = restrictionInfo.userAccess.canManage;

  const handleAccessChange = async (value: "open" | "restricted") => {
    if (value === "restricted" && !isRestricted) {
      await restrictMutation.mutateAsync(pageId);
    } else if (value === "open" && isRestricted) {
      await unrestrictMutation.mutateAsync(pageId);
    }
  };

  const handleAddMembers = async () => {
    if (memberIds.length === 0) return;

    const userIds = memberIds
      .filter((id) => id.startsWith("user-"))
      .map((id) => id.replace("user-", ""));

    const groupIds = memberIds
      .filter((id) => id.startsWith("group-"))
      .map((id) => id.replace("group-", ""));

    await addPermissionMutation.mutateAsync({
      pageId,
      role: role as PagePermissionRole,
      ...(userIds.length > 0 && { userIds }),
      ...(groupIds.length > 0 && { groupIds }),
    });

    setMemberIds([]);
  };

  const handleRemoveAll = async () => {
    await unrestrictMutation.mutateAsync(pageId);
  };

  return (
    <Stack gap="sm">
      {isRestricted && canManage && !isInherited && (
        <>
          <Group gap="xs" align="flex-end">
            <div style={{ flex: 1 }}>
              <MultiMemberSelect onChange={setMemberIds} />
            </div>
            <Select
              data={pagePermissionRoleData.map((r) => ({
                label: t(r.label),
                value: r.value,
              }))}
              value={role}
              onChange={(value) => value && setRole(value)}
              allowDeselect={false}
              variant="filled"
              w={120}
            />
            <Button
              onClick={handleAddMembers}
              disabled={memberIds.length === 0}
              loading={addPermissionMutation.isPending}
            >
              {t("Add")}
            </Button>
          </Group>
          <Divider />
        </>
      )}

      <div>
        <Text size="sm" fw={500} mb="xs">
          {t("General access")}
        </Text>
        <GeneralAccessSelect
          value={isRestricted ? "restricted" : "open"}
          onChange={handleAccessChange}
          disabled={!canManage || isInherited}
          isInherited={isInherited}
        />
        {isInherited && (
          <div className={classes.inheritedInfo}>
            <Text size="xs" c="dimmed">
              {t("Inherits restrictions from")}
            </Text>
            <Link
              to={buildPageUrl(
                spaceSlug,
                restrictionInfo.id,
                restrictionInfo.title,
              )}
              style={{ textDecoration: "none" }}
            >
              <Group gap={4}>
                <Text size="xs" fw={500}>
                  {restrictionInfo.title || t("Untitled")}
                </Text>
                <IconArrowRight size={12} />
              </Group>
            </Link>
          </div>
        )}
      </div>

      {isRestricted && (
        <>
          {isLoading ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          ) : (
            <PagePermissionList
              pageId={pageId}
              members={permissionsData?.items || []}
              canManage={canManage && !isInherited}
              onRemoveAll={handleRemoveAll}
            />
          )}
        </>
      )}
    </Stack>
  );
}
