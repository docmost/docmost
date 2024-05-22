import React, { useRef } from "react";
import { Avatar } from "@mantine/core";
import { getAvatarUrl } from "@/lib/config.ts";

interface UserAvatarProps {
  avatarUrl: string;
  name: string;
  color?: string;
  size?: string | number;
  radius?: string | number;
  style?: any;
  component?: any;
}

export const UserAvatar = React.forwardRef<HTMLInputElement, UserAvatarProps>(
  ({ avatarUrl, name, ...props }: UserAvatarProps, ref) => {
    const avatar = getAvatarUrl(avatarUrl);

    const getInitials = (name: string) => {
      const names = name?.split(" ");
      return names
        ?.slice(0, 2)
        .map((n) => n[0])
        .join("");
    };

    return avatar ? (
      <Avatar ref={ref} src={avatar} alt={name} radius="xl" {...props} />
    ) : (
      <Avatar ref={ref} {...props}>
        {getInitials(name)}
      </Avatar>
    );
  },
);
