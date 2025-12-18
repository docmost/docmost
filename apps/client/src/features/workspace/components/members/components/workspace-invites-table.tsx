import { Group, Table, Avatar, Text, Alert } from "@mantine/core";
import { useWorkspaceInvitationsQuery } from "@/features/workspace/queries/workspace-query.ts";
import React, { useState } from "react";
import { getUserRoleLabel } from "@/features/workspace/types/user-role-data.ts";
import InviteActionMenu from "@/features/workspace/components/members/components/invite-action-menu.tsx";
import { IconInfoCircle } from "@tabler/icons-react";
import { timeAgo } from "@/lib/time.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { useTranslation } from "react-i18next";
import Paginate from "@/components/common/paginate.tsx";

export default function WorkspaceInvitesTable() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useWorkspaceInvitationsQuery({
    page,
    limit: 100,
  });
  const { isAdmin } = useUserRole();

  return (
    <>
      <Alert variant="light" color="blue" icon={<IconInfoCircle />}>
        {t(
          "Invited members who are yet to accept their invitation will appear here.",
        )}
      </Alert>

      <Table.ScrollContainer minWidth={600}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Email")}</Table.Th>
              <Table.Th>{t("Role")}</Table.Th>
              <Table.Th>{t("Date")}</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {data?.items.map((invitation, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Group gap="sm" wrap="nowrap">
                    <Avatar name={invitation.email} color="initials" />
                    <div>
                      <Text fz="sm" fw={500}>
                        {invitation.email}
                      </Text>
                    </div>
                  </Group>
                </Table.Td>

                <Table.Td>{t(getUserRoleLabel(invitation.role))}</Table.Td>

                <Table.Td>{timeAgo(invitation.createdAt)}</Table.Td>

                <Table.Td>
                  {isAdmin && <InviteActionMenu invitationId={invitation.id} />}
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
