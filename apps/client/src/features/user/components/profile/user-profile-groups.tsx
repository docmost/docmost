import { ReactNode } from "react";
import {
  Anchor,
  Badge,
  Button,
  Group,
  Skeleton,
  Table,
  Text,
  Tooltip,
  VisuallyHidden,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import {
  IconAlertTriangle,
  IconLock,
  IconPlus,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { IconGroupCircle } from "@/components/icons/icon-people-circle";
import { EmptyState } from "@/components/ui/empty-state";
import { useRemoveGroupMemberMutation } from "@/features/group/queries/group-query";
import { AddUserToGroupsModal } from "@/features/user/components/profile/add-user-to-groups-modal";
import { UserProfileCard } from "@/features/user/components/profile/user-profile-card";
import { useUserGroupsQuery } from "@/features/user/queries/user-query";
import {
  IUserProfile,
  IUserProfileGroup,
} from "@/features/user/types/user.types";
import useUserRole from "@/hooks/use-user-role";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale";
import { formatMemberCount } from "@/lib/utils";
import rowClasses from "@/components/ui/clickable-table-row.module.css";
import classes from "@/features/user/components/profile/user-profile.module.css";

type UserProfileGroupsProps = {
  profile: IUserProfile;
};

export function UserProfileGroups({ profile }: UserProfileGroupsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const [addOpened, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const removeGroupMemberMutation = useRemoveGroupMemberMutation();
  const {
    data,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useUserGroupsQuery(profile.id, isAdmin);
  const groups = data?.pages.flatMap((p) => p.items) ?? [];

  const openRemoveModal = (group: IUserProfileGroup) =>
    modals.openConfirmModal({
      title: t("Remove group member"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to remove this user from the group? The user will lose access to resources this group has access to.",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () =>
        removeGroupMemberMutation.mutate(
          { groupId: group.id, userId: profile.id },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({
                queryKey: ["user-groups", profile.id],
              });
              queryClient.invalidateQueries({
                queryKey: ["user-spaces", profile.id],
              });
            },
          },
        ),
    });

  return (
    <>
      <UserProfileCard
        title={t("Groups")}
        description={
          <span className={classes.metaItem}>
            <IconLock size={14} aria-hidden />
            {t("Only admins can see this tab.")}
          </span>
        }
        action={
          !profile.deletedAt && (
            <Button
              variant="default"
              size="xs"
              leftSection={<IconPlus size={14} aria-hidden />}
              onClick={openAdd}
            >
              {t("Add to group")}
            </Button>
          )
        }
      >
        {isPending ? (
          <div role="status" aria-busy="true" aria-label={t("Loading groups")}>
            <GroupsTable loading>
              <GroupRowSkeleton nameWidth={140} />
              <GroupRowSkeleton nameWidth={100} />
              <GroupRowSkeleton nameWidth={120} />
            </GroupsTable>
          </div>
        ) : groups.length > 0 ? (
          <>
            <GroupsTable>
              {groups.map((group) => (
                <GroupRow
                  key={group.id}
                  group={group}
                  userName={profile.name}
                  onRemove={openRemoveModal}
                />
              ))}
            </GroupsTable>
            {hasNextPage && (
              <Button
                variant="subtle"
                fullWidth
                mt="sm"
                onClick={() => fetchNextPage()}
                loading={isFetchingNextPage}
              >
                {t("Load more")}
              </Button>
            )}
          </>
        ) : isError ? (
          <EmptyState
            icon={IconAlertTriangle}
            title={t("Something went wrong")}
            action={
              <Button
                variant="default"
                size="sm"
                mt="xs"
                onClick={() => refetch()}
              >
                {t("Try again")}
              </Button>
            }
          />
        ) : (
          <EmptyState icon={IconUsersGroup} title={t("No groups")} />
        )}
      </UserProfileCard>

      <AddUserToGroupsModal
        profile={profile}
        excludeIds={groups.map((group) => group.id)}
        opened={addOpened}
        onClose={closeAdd}
      />
    </>
  );
}

type GroupsTableProps = {
  loading?: boolean;
  children: ReactNode;
};

function GroupsTable({ loading, children }: GroupsTableProps) {
  const { t } = useTranslation();

  return (
    <Table.ScrollContainer minWidth={640}>
      <Table
        verticalSpacing="sm"
        highlightOnHover={!loading}
        aria-hidden={loading || undefined}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("Group")}</Table.Th>
            <Table.Th>{t("Members")}</Table.Th>
            <Table.Th>{t("Source")}</Table.Th>
            <Table.Th>{t("Added")}</Table.Th>
            <Table.Th>
              <VisuallyHidden>{t("Action")}</VisuallyHidden>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{children}</Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

type GroupRowProps = {
  group: IUserProfileGroup;
  userName: string;
  onRemove: (group: IUserProfileGroup) => void;
};

function GroupRow({ group, userName, onRemove }: GroupRowProps) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();

  return (
    <Table.Tr className={rowClasses.row}>
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <IconGroupCircle />
          <div className={classes.groupName}>
            <Anchor
              component={Link}
              to={`/settings/groups/${group.id}`}
              size="sm"
              fw={500}
              underline="never"
              lineClamp={1}
              className={rowClasses.link}
              style={{ color: "var(--mantine-color-text)" }}
            >
              {group.name}
            </Anchor>
            {group.description && (
              <Text fz="xs" c="dimmed" lineClamp={2}>
                {group.description}
              </Text>
            )}
          </div>
        </Group>
      </Table.Td>
      <Table.Td>
        <Text fz="sm" className={classes.nowrap}>
          {formatMemberCount(group.memberCount, t)}
        </Text>
      </Table.Td>
      <Table.Td>
        {group.isDefault ? (
          <Tooltip label={t("Every member is in this group")}>
            <Badge variant="default" tabIndex={0}>
              {t("Default")}
            </Badge>
          </Tooltip>
        ) : group.isExternal ? (
          <Tooltip label={t("Membership is managed by your identity provider")}>
            <Badge variant="default" tabIndex={0}>
              {t("Synced")}
            </Badge>
          </Tooltip>
        ) : (
          <Badge variant="default">{t("Manual")}</Badge>
        )}
      </Table.Td>
      <Table.Td>
        <Text fz="sm" className={classes.nowrap}>
          {formatLocalized(group.addedAt, "MMM d, yyyy", "PP", locale)}
        </Text>
      </Table.Td>
      <Table.Td>
        {group.isDefault ? (
          <Text fz="sm" c="dimmed" className={classes.nowrap}>
            {t("Default group")}
          </Text>
        ) : group.isExternal ? (
          <Text fz="sm" c="dimmed" className={classes.nowrap}>
            {t("Managed externally")}
          </Text>
        ) : (
          <Button
            variant="default"
            c="red"
            size="xs"
            aria-label={t("Remove {{name}} from {{group}}", {
              name: userName,
              group: group.name,
            })}
            onClick={() => onRemove(group)}
          >
            {t("Remove")}
          </Button>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

function GroupRowSkeleton({ nameWidth }: { nameWidth: number }) {
  return (
    <Table.Tr>
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <Skeleton circle height={34} flex="none" />
          <div>
            <Skeleton height={14} width={nameWidth} radius="xs" my={4} />
            <Skeleton height={12} width={nameWidth + 50} radius="xs" my={4} />
          </div>
        </Group>
      </Table.Td>
      <Table.Td>
        <Skeleton height={14} width={76} radius="xs" />
      </Table.Td>
      <Table.Td>
        <Skeleton height={20} width={64} radius="xl" />
      </Table.Td>
      <Table.Td>
        <Skeleton height={14} width={88} radius="xs" />
      </Table.Td>
      <Table.Td>
        <Skeleton height={30} width={72} radius="sm" />
      </Table.Td>
    </Table.Tr>
  );
}
