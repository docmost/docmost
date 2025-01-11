import { IRoleData, UserRole } from "@/lib/types.ts";

export const userRoleData: IRoleData[] = [
  {
    label: "Owner",
    value: UserRole.OWNER,
    description: "Can manage workspace",
  },
  {
    label: "Admin",
    value: UserRole.ADMIN,
    description: "Can manage workspace but cannot delete it",
  },
  {
    label: "Member",
    value: UserRole.MEMBER,
    description: "Can become members of groups and spaces in workspace",
  },
];

export function getUserRoleLabel(value: string) {
  const role = userRoleData.find((item) => item.value === value);
  return role ? role.label : undefined;
}
