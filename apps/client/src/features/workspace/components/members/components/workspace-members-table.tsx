import {
	Group,
	Table,
	Text,
	Badge,
	Button,
	Popover,
	Box,
	Flex,
} from "@mantine/core";
import {
	useChangeMemberRoleMutation,
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
import { IUser } from "../../../../user/types/user.types";
import { useDisclosure } from "@mantine/hooks";

interface WorkspaceMembersTableRowProps {
	user: IUser;
	assignableUserRoles: IRoleData[];
	handleRoleChange: (
		userId: string,
		currentRole: string,
		newRole: string
	) => Promise<void>;
	isAdmin: boolean;
}

const WorkspaceMembersTableRow: FC<WorkspaceMembersTableRowProps> = ({
	user,
	assignableUserRoles,
	handleRoleChange,
	isAdmin,
}) => {
	const [opened, { open, close }] = useDisclosure(false);

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
				<Badge variant="light">Active</Badge>
			</Table.Td>

			<Table.Td>
				<RoleSelectMenu
					roles={assignableUserRoles}
					roleName={getUserRoleLabel(user.role)}
					onChange={newRole => handleRoleChange(user.id, user.role, newRole)}
					disabled={!isAdmin}
				/>
			</Table.Td>
			<Table.Td>
				<Popover
					position="bottom"
					withArrow
					shadow="md"
					opened={opened}
					onClose={close}
				>
					<Popover.Target>
						<Button variant="subtle" color="red" onClick={open}>
							<IconTrash size={20} />
						</Button>
					</Popover.Target>
					<Popover.Dropdown>
						<Text>Are you sure? This action is not reversible</Text>
						<Flex justify={"space-evenly"} align={"center"} mt={8}>
							<Button variant="outline" onClick={close}>
								Cancel
							</Button>
							<Button color="red">Confirm</Button>
						</Flex>
					</Popover.Dropdown>
				</Popover>
			</Table.Td>
		</Table.Tr>
	);
};

export default function WorkspaceMembersTable() {
	const { data, isLoading } = useWorkspaceMembersQuery({ limit: 100 });
	const changeMemberRoleMutation = useChangeMemberRoleMutation();
	const { isAdmin, isOwner } = useUserRole();

	const assignableUserRoles = isOwner
		? userRoleData
		: userRoleData.filter(role => role.value !== UserRole.OWNER);

	const handleRoleChange = async (
		userId: string,
		currentRole: string,
		newRole: string
	) => {
		if (newRole === currentRole) {
			return;
		}

		const memberRoleUpdate = {
			userId: userId,
			role: newRole,
		};

		await changeMemberRoleMutation.mutateAsync(memberRoleUpdate);
	};

	return (
		<>
			{data && (
				<Table verticalSpacing="sm">
					<Table.Thead>
						<Table.Tr>
							<Table.Th>User</Table.Th>
							<Table.Th>Status</Table.Th>
							<Table.Th>Role</Table.Th>
							<Table.Th>Action</Table.Th>
						</Table.Tr>
					</Table.Thead>

					<Table.Tbody>
						{data?.items.map((user, index) => (
							<WorkspaceMembersTableRow
								key={index}
								user={user}
								assignableUserRoles={assignableUserRoles}
								isAdmin={isAdmin}
								handleRoleChange={handleRoleChange}
							/>
						))}
					</Table.Tbody>
				</Table>
			)}
		</>
	);
}
