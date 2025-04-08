import { Group, Table, Text, Menu, ActionIcon } from "@mantine/core";
import { IconDots } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import {
  getSpaceRoleLabel,
  spaceRoleData,
} from "@/features/space/types/space-role-data.ts";
import { formatMemberCount } from "@/lib";
import { useTranslation } from "react-i18next";
import Paginate from "@/components/common/paginate.tsx";
import { SearchInput } from "@/components/common/search-input.tsx";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search.tsx";
import {
  useChangePageMemberRoleMutation,
  usePageMembersQuery,
  useRemovePageMemberMutation,
} from "../queries/page-query";
import { IRemovePageMember } from "../types/page.types";
import RoleSelectMenu from "@/components/ui/role-select-menu";
import { IconGroupCircle } from "@/components/icons/icon-people-circle";

type MemberType = "user" | "group";

interface PageMembersProps {
  pageId: string;
  readOnly?: boolean;
}

export default function PageMembersList({
  pageId,
  readOnly,
}: PageMembersProps) {
  const { t } = useTranslation();
  const { search, page, setPage, handleSearch } = usePaginateAndSearch();
  const { data, isLoading } = usePageMembersQuery(pageId, {
    page,
    limit: 100,
    query: search,
  });
  const removePageMember = useRemovePageMemberMutation();
  const changePageMemberRoleMutation = useChangePageMemberRoleMutation();

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
      pageId: string;
      role: string;
      userId?: string;
      groupId?: string;
    } = {
      pageId: pageId,
      role: newRole,
    };

    if (type === "user") {
      memberRoleUpdate.userId = memberId;
    }
    if (type === "group") {
      memberRoleUpdate.groupId = memberId;
    }

    await changePageMemberRoleMutation.mutateAsync(memberRoleUpdate);
  };

  const onRemove = async (memberId: string, type: MemberType) => {
    const memberToRemove: IRemovePageMember = {
      pageId: pageId,
    };

    if (type === "user") {
      memberToRemove.userId = memberId;
    }
    if (type === "group") {
      memberToRemove.groupId = memberId;
    }

    await removePageMember.mutateAsync(memberToRemove);
  };

  const openRemoveModal = (memberId: string, type: MemberType) =>
    modals.openConfirmModal({
      title: t("Remove page member"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to remove this user from the page? The user will lose all access to this page.",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Remove"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => onRemove(memberId, type),
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
            {data?.items.map((member, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Group gap="sm" wrap="nowrap">
                    {member.type === "user" && (
                      <CustomAvatar
                        avatarUrl={member?.avatarUrl}
                        name={member.name}
                      />
                    )}

                    {member.type === "group" && <IconGroupCircle />}

                    <div>
                      <Text fz="sm" fw={500} lineClamp={1}>
                        {member?.name}
                      </Text>
                      <Text fz="xs" c="dimmed">
                        {member.type == "user" && member?.email}

                        {member.type == "group" &&
                          `${t("Group")} - ${formatMemberCount(member?.memberCount, t)}`}
                      </Text>
                    </div>
                  </Group>
                </Table.Td>

                <Table.Td>
                  <RoleSelectMenu
                    roles={spaceRoleData}
                    roleName={getSpaceRoleLabel(member.role)}
                    onChange={(newRole) =>
                      handleRoleChange(
                        member.id,
                        member.type,
                        newRole,
                        member.role,
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
                            openRemoveModal(member.id, member.type)
                          }
                        >
                          {t("Remove member")}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {data?.items.length > 0 && (
        <Paginate
          currentPage={page}
          hasPrevPage={data?.meta.hasPrevPage}
          hasNextPage={data?.meta.hasNextPage}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
