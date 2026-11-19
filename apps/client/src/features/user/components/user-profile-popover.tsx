import { ReactElement } from "react";
import { Popover } from "@mantine/core";
import { UserCardContent } from "@/features/user/components/user-card-content";

type UserProfilePopoverProps = {
  userId: string;
  children: ReactElement;
  withinPortal?: boolean;
};

export function UserProfilePopover({
  userId,
  children,
  withinPortal = true,
}: UserProfilePopoverProps) {
  return (
    <Popover
      position="right-start"
      offset={12}
      shadow="md"
      radius="md"
      width={280}
      withArrow
      withinPortal={withinPortal}
    >
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown p="md">
        <UserCardContent userId={userId} />
      </Popover.Dropdown>
    </Popover>
  );
}
