import { ReactElement } from "react";
import { HoverCard } from "@mantine/core";
import { UserCardContent } from "@/features/user/components/user-card-content";

type UserHoverCardProps = {
  userId: string;
  children: ReactElement;
};

export function UserHoverCard({ userId, children }: UserHoverCardProps) {
  return (
    <HoverCard
      position="bottom-start"
      shadow="md"
      radius="md"
      openDelay={300}
      closeDelay={150}
      width={280}
      withArrow
    >
      <HoverCard.Target>{children}</HoverCard.Target>
      <HoverCard.Dropdown p="md">
        <UserCardContent userId={userId} />
      </HoverCard.Dropdown>
    </HoverCard>
  );
}
