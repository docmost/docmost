import { IRoleData, SpaceRole } from "@/lib/types.ts";
import i18n from "@/i18n.ts";

export const spaceRoleData: IRoleData[] = [
  {
    label: i18n.t("Full access"),
    value: SpaceRole.ADMIN,
    description: i18n.t("Has full access to space settings and pages."),
  },
  {
    label: i18n.t("Can edit"),
    value: SpaceRole.WRITER,
    description: i18n.t("Can create and edit pages in space."),
  },
  {
    label: i18n.t("Can view"),
    value: SpaceRole.READER,
    description: i18n.t("Can view pages in space but not edit."),
  },
];

export function getSpaceRoleLabel(value: string) {
  const role = spaceRoleData.find((item) => item.value === value);
  return role ? role.label : undefined;
}
