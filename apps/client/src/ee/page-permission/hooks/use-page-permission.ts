import { useSpaceAbility } from "@/features/space/permissions/use-space-ability";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type";
import { usePageRestrictionInfoQuery } from "@/ee/page-permission/queries/page-permission-query";

export function usePagePermission(pageId: string, spaceRules: any) {
  const spaceAbility = useSpaceAbility(spaceRules);
  const { data: restrictionInfo, isLoading } =
    usePageRestrictionInfoQuery(pageId);

  if (isLoading || !restrictionInfo) {
    return { canEdit: false, restrictionInfo: undefined };
  }

  const hasRestriction =
    restrictionInfo.hasDirectRestriction ||
    restrictionInfo.hasInheritedRestriction;

  const canEdit = hasRestriction
    ? (restrictionInfo.userAccess?.canEdit ?? false)
    : spaceAbility.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page);

  return { canEdit, restrictionInfo };
}
