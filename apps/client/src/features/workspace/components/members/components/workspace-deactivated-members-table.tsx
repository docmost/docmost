import {
	Group,
	Table,
	Text,
	Badge,
	Button,
	Popover,
	Box,
	Flex,
	Tooltip,
} from "@mantine/core";
import {
	useChangeMemberRoleMutation,
	useDeactivateUserMutation,
	useWorkspaceDeactivatedMembersQuery,
	useWorkspaceMembersQuery,
} from "@/features/workspace/queries/workspace-query.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import React, { FC } from "react";
import RoleSelectMenu from "@/components/ui/role-select-menu.tsx";
import {
	getUserRoleLabel,
	userRoleData,
} from "@/features/workspace/types/user-role-data.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { IRoleData, UserRole } from "@/lib/types.ts";
import { IconTrash } from "@tabler/icons-react";
import { ICurrentUser, IUser } from "../../../../user/types/user.types";
import { useDisclosure } from "@mantine/hooks";
import { useAtom } from "jotai";
import { currentUserAtom } from "../../../../user/atoms/current-user-atom";

interface WorkspaceDeactivatedMembersTableRowProps {
	user: IUser;
	isAdmin: boolean;
	isOwner: boolean;
	currentUser: ICurrentUser;
}

const WorkspaceDeactivatedMembersTableRow: FC<
	WorkspaceDeactivatedMembersTableRowProps
> = ({ user, isAdmin, isOwner, currentUser }) => {
	const [opened, { open, close }] = useDisclosure(false);
	const deactivateUserMutation = useDeactivateUserMutation();

	const handleDelete = async (userId: string) => {
		if (userId && currentUser?.workspace?.id)
			await deactivateUserMutation.mutateAsync({
				userId,
				workspaceId: currentUser?.workspace?.id,
			});
	};

	return (
		<Table.Tr>
			<Table.Td>
				<Group gap="sm">
					<CustomAvatar avatarUrl={user.avatarUrl} name={user.name} />
					<div>
						<Text fz="sm" fw={500}>
							{user.name}
						</Text>
						<Text fz="xs" c="dimmed">
							{user.email}
						</Text>
					</div>
				</Group>
			</Table.Td>

			<Table.Td>
				<Badge variant="light" color="gray">
					Deactivated
				</Badge>
			</Table.Td>

			{(isOwner || isAdmin) && (
				<Table.Td>
					<Popover
						position="bottom"
						withArrow
						shadow="md"
						opened={opened}
						onClose={close}
					>
						<Popover.Target>
							<Button
								variant="subtle"
								color="red"
								onClick={open}
								disabled={
									// currentUser.user.role === "admin" && user.role === "owner"
									true
								}
							>
								<Tooltip label="Permanently delete member">
									<IconTrash size={20} />
								</Tooltip>
							</Button>
						</Popover.Target>
						<Popover.Dropdown>
							<Text>
								Are you sure? This action is <strong>not reversible</strong>
							</Text>
							<Flex justify={"space-evenly"} align={"center"} mt={8}>
								<Button variant="outline" onClick={close}>
									Cancel
								</Button>
								<Button color="red" onClick={() => handleDelete(user?.id)}>
									Confirm
								</Button>
							</Flex>
						</Popover.Dropdown>
					</Popover>
				</Table.Td>
			)}
		</Table.Tr>
	);
};

export default function WorkspaceDeactivatedMembersTable() {
	const { data, isLoading } = useWorkspaceDeactivatedMembersQuery({
		limit: 100,
	});
	const { isAdmin, isOwner } = useUserRole();
	const [currentUser] = useAtom(currentUserAtom);

	return (
		<>
			{data && (
				<Table verticalSpacing="sm">
					<Table.Thead>
						<Table.Tr>
							<Table.Th>User</Table.Th>
							<Table.Th>Status</Table.Th>
							{(isOwner || isAdmin) && <Table.Th>Action</Table.Th>}
						</Table.Tr>
					</Table.Thead>

					<Table.Tbody>
						{data?.items.map((user, index) => (
							<WorkspaceDeactivatedMembersTableRow
								key={index}
								user={user}
								isAdmin={isAdmin}
								isOwner={isOwner}
								currentUser={currentUser}
							/>
						))}
					</Table.Tbody>
				</Table>
			)}
		</>
	);
}
