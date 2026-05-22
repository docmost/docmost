import { useState } from "react";
import {
  Box,
  Button,
  Divider,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { IconArrowRight, IconLock, IconShieldLock } from "@tabler/icons-react";
import { MultiMemberSelect } from "@/features/space/components/multi-member-select";
import {
  IPageRestrictionInfo,
  PagePermissionRole,
} from "@/ee/page-permission/types/page-permission.types";
import {
  useAddPagePermissionMutation,
  useRestrictPageMutation,
  useUnrestrictPageMutation,
} from "@/ee/page-permission/queries/page-permission-query";
import { pagePermissionRoleData } from "@/ee/page-permission/types/page-permission-role-data";
import { GeneralAccessSelect } from "@/ee/page-permission";
import { PagePermissionList } from "@/ee/page-permission";
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

  const restrictMutation = useRestrictPageMutation();
  const unrestrictMutation = useUnrestrictPageMutation();
  const addPermissionMutation = useAddPagePermissionMutation();

  const hasInheritedRestriction = restrictionInfo.hasInheritedRestriction;
  const hasDirectRestriction = restrictionInfo.hasDirectRestriction;
  const canManage = restrictionInfo.userAccess.canManage;

  const handleDirectAccessChange = async (value: "open" | "restricted") => {
    if (value === "restricted" && !hasDirectRestriction) {
      await restrictMutation.mutateAsync(pageId);
    } else if (value === "open" && hasDirectRestriction) {
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
    <Stack gap="md">
      {hasInheritedRestriction && (
        <Paper className={classes.inheritedSection} p="sm" radius="sm">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon
              size="lg"
              radius="sm"
              variant="light"
              color="orange"
            >
              <IconShieldLock size={18} stroke={1.5} />
            </ThemeIcon>
            <Box style={{ flex: 1 }}>
              <Text size="sm" fw={500}>
                {t("Inherited restriction")}
              </Text>
              <Group gap={4}>
                <Text size="xs" c="dimmed">
                  {t("Access limited by")}
                </Text>
                {restrictionInfo.inheritedFrom && (
                  <Link
                    to={buildPageUrl(
                      spaceSlug,
                      restrictionInfo.inheritedFrom.slugId,
                      restrictionInfo.inheritedFrom.title,
                    )}
                    style={{ textDecoration: "none" }}
                  >
                    <Group gap={2}>
                      <Text size="xs" fw={500} c="blue">
                        {restrictionInfo.inheritedFrom.title || t("Untitled")}
                      </Text>
                      <IconArrowRight size={12} color="var(--mantine-color-blue-6)" />
                    </Group>
                  </Link>
                )}
              </Group>
            </Box>
          </Group>
        </Paper>
      )}

      <Box>
        <GeneralAccessSelect
          value={hasDirectRestriction ? "restricted" : "open"}
          onChange={handleDirectAccessChange}
          disabled={!canManage}
          hasInheritedRestriction={hasInheritedRestriction}
        />
        {!hasDirectRestriction && !hasInheritedRestriction && (
          <Text size="xs" c="dimmed" mt={4}>
            {t("Restrict access to control who can view and edit this page")}
          </Text>
        )}
        {!hasDirectRestriction && hasInheritedRestriction && (
          <Text size="xs" c="dimmed" mt={4}>
            {t("Add additional restrictions specific to this page")}
          </Text>
        )}
      </Box>

      {hasDirectRestriction && (
        <>
          <Divider />

          {canManage && (
            <Group gap="xs" align="flex-end">
              <Box style={{ flex: 1 }}>
                <MultiMemberSelect value={memberIds} onChange={setMemberIds} />
              </Box>
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
          )}

          <PagePermissionList
            pageId={pageId}
            canManage={canManage}
            onRemoveAll={handleRemoveAll}
          />
        </>
      )}
    </Stack>
  );
}
