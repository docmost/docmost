import { Text } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useLocation } from "react-router-dom";
import { validate as isValidUuid } from "uuid";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { UserHoverCard } from "@/features/user/components/user-hover-card";
import { useUserProfileQuery } from "@/features/user/queries/user-query";
import classes from "./mention.module.css";

type UserMentionProps = {
  label: string;
  entityId: string;
};

export function UserMention({ label, entityId }: UserMentionProps) {
  const location = useLocation();
  const currentUser = useAtomValue(currentUserAtom);
  const isShareRoute = location.pathname.startsWith("/share");
  const isPublicSpaceRoute = location.pathname.startsWith("/docs/");

  const canLoadProfile =
    !isShareRoute &&
    !isPublicSpaceRoute &&
    !!currentUser &&
    !!entityId &&
    isValidUuid(entityId);

  const { data: profile } = useUserProfileQuery(entityId, {
    enabled: canLoadProfile,
  });

  // the saved label stays for anyone who is not an active member
  const isActiveMember =
    canLoadProfile && !!profile && !profile.deactivatedAt && !profile.deletedAt;
  const name = isActiveMember ? profile.name : label;

  const mention = (
    <Text className={classes.userMention} component="span">
      @{name}
    </Text>
  );

  return canLoadProfile ? (
    <UserHoverCard userId={entityId}>{mention}</UserHoverCard>
  ) : (
    mention
  );
}
