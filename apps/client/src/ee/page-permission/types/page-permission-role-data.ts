import { IRoleData } from "@/lib/types";
import { PagePermissionRole } from "./page-permission.types";

export const pagePermissionRoleData: IRoleData[] = [
  {
    label: "Can edit",
    value: PagePermissionRole.WRITER,
    description: "Can edit page and manage access",
  },
  {
    label: "Can view",
    value: PagePermissionRole.READER,
    description: "Can only view page",
  },
];

export function getPagePermissionRoleLabel(value: string): string | undefined {
  const role = pagePermissionRoleData.find((item) => item.value === value);
  return role ? role.label : undefined;
}
