import { Text } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useLocation } from "react-router-dom";
import { validate as isValidUuid } from "uuid";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { UserHoverCard } from "@/features/user/components/user-hover-card";
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

  const mention = (
    <Text className={classes.userMention} component="span">
      @{label}
    </Text>
  );

  const showCard =
    !isShareRoute &&
    !isPublicSpaceRoute &&
    !!currentUser &&
    !!entityId &&
    isValidUuid(entityId);

  return showCard ? (
    <UserHoverCard userId={entityId}>{mention}</UserHoverCard>
  ) : (
    mention
  );
}
