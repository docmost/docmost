import { Group, Table, Text, Menu, ActionIcon } from "@mantine/core";
import React from "react";
import { IconDots } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import {
  useChangeSpaceMemberRoleMutation,
  useRemoveSpaceMemberMutation,
  useSpaceMembersQuery,
  useSpaceQuery,
} from "@/features/space/queries/space-query.ts";
import { IconGroupCircle } from "@/components/icons/icon-people-circle.tsx";
import { IRemoveSpaceMember } from "@/features/space/types/space.types.ts";
import RoleSelectMenu from "@/components/ui/role-select-menu.tsx";
import {
  getSpaceRoleLabel,
  spaceRoleData,
} from "@/features/space/types/space-role-data.ts";
import { formatMemberCount } from "@/lib";
import { useTranslation } from "react-i18next";
import Paginate from "@/components/common/paginate.tsx";
import { SearchInput } from "@/components/common/search-input.tsx";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search.tsx";
import { SpaceRole } from "@/lib/types";

type MemberType = "user" | "group";

interface MemberRowProps {
  memberId: string;
  memberType: MemberType;
  memberRole: SpaceRole;
  memberName: string;
  memberAvatarUrl?: string;
  memberEmail?: string;
  groupMemberCount?: number;
  spaceId: string;
  readOnly?: boolean;
}

const MemberRow = (props: MemberRowProps) => {
  const {
    memberId,
    memberType,
    memberRole,
    memberName,
    memberAvatarUrl,
    memberEmail,
    groupMemberCount,
    spaceId,
    readOnly
  } = props
  const { t } = useTranslation();
  const removeSpaceMember = useRemoveSpaceMemberMutation();
  const changeSpaceMemberRoleMutation = useChangeSpaceMemberRoleMutation();

  const handleRoleChange = async (
    memberId: string,
    type: MemberType,
    newRole: string,
    currentRole: string,
  ) => {
    if (newRole === currentRole) {
      return;
    }

    const memberRoleUpdate: {
      spaceId: string;
      role: string;
      userId?: string;
      groupId?: string;
    } = {
      spaceId: spaceId,
      role: newRole,
    };

    if (type === "user") {
      memberRoleUpdate.userId = memberId;
    }
    if (type === "group") {
      memberRoleUpdate.groupId = memberId;
    }

    await changeSpaceMemberRoleMutation.mutateAsync(memberRoleUpdate);
  };

  const onRemove = async (memberId: string, type: MemberType) => {
    const memberToRemove: IRemoveSpaceMember = {
      spaceId: spaceId,
    };

    if (type === "user") {
      memberToRemove.userId = memberId;
    }
    if (type === "group") {
      memberToRemove.groupId = memberId;
    }

    await removeSpaceMember.mutateAsync(memberToRemove);
  };

  const openRemoveModal = (memberId: string, type: MemberType) =>
    modals.openConfirmModal({
      title: t("Remove space member"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to remove this user from the space? The user will lose all access to this space.",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Remove"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => onRemove(memberId, type),
    });

  return (
    <Table.Tr>
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          {memberType === "user" && (
            <CustomAvatar
              avatarUrl={memberAvatarUrl}
              name={memberName}
            />
          )}

          {memberType === "group" && <IconGroupCircle />}

          <div>
            <Text fz="sm" fw={500} lineClamp={1}>
              {memberName}
            </Text>
            <Text fz="xs" c="dimmed">
              {memberType == "user" && memberEmail}

              {memberType == "group" && groupMemberCount !== undefined &&
                `${t("Group")} - ${formatMemberCount(groupMemberCount, t)}`}
            </Text>
          </div>
        </Group>
      </Table.Td>

      <Table.Td>
        <RoleSelectMenu
          roles={spaceRoleData}
          roleName={getSpaceRoleLabel(memberRole)}
          onChange={(newRole) =>
            handleRoleChange(
              memberId,
              memberType,
              newRole,
              memberRole,
            )
          }
          disabled={readOnly}
        />
      </Table.Td>

      <Table.Td>
        {!readOnly && (
          <Menu
            shadow="xl"
            position="bottom-end"
            offset={20}
            width={200}
            withArrow
            arrowPosition="center"
          >
            <Menu.Target>
              <ActionIcon variant="subtle" c="gray">
                <IconDots size={20} stroke={2} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item
                onClick={() =>
                  openRemoveModal(memberId, memberType)
                }
              >
                {t("Remove space member")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Table.Td>
    </Table.Tr>
  )
}

interface SpaceMembersProps {
  spaceId: string;
  readOnly?: boolean;
}

export default function SpaceMembersList({
  spaceId,
  readOnly,
}: SpaceMembersProps) {
  const { t } = useTranslation();
  const { search, page, setPage, handleSearch } = usePaginateAndSearch();
  const { data: space } = useSpaceQuery(spaceId);
  const { data: spaceMembers } = useSpaceMembersQuery(spaceId, {
    page,
    limit: 100,
    query: search,
  });

  return (
    <>
      <SearchInput onSearch={handleSearch} />
      <Table.ScrollContainer minWidth={500}>
        <Table highlightOnHover verticalSpacing={8}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Member")}</Table.Th>
              <Table.Th>{t("Role")}</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {spaceMembers?.items.map((member, index) => (
              <MemberRow
                key={index}
                memberId={member.id}
                memberType={member.type}
                memberRole={member.role}
                memberName={member.name}
                memberAvatarUrl={member.type === "user" ? member.avatarUrl : undefined}
                memberEmail={member.type === "user" ? member.email : undefined}
                groupMemberCount={member.type === "group" ? member.memberCount : undefined}
                spaceId={spaceId}
                readOnly={readOnly}
              />
            ))}
            {space?.isPublished && (
              <MemberRow
                memberId={""}
                memberType={"group"}
                memberRole={SpaceRole.READER}
                memberName={t("Anyone with link")}
                spaceId={spaceId}
                readOnly={true}
              />
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {spaceMembers?.items.length > 0 && (
        <Paginate
          currentPage={page}
          hasPrevPage={spaceMembers?.meta.hasPrevPage}
          hasNextPage={spaceMembers?.meta.hasNextPage}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
