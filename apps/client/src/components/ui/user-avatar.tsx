import React from 'react';
import { Avatar } from '@mantine/core';

interface UserAvatarProps {
  avatarUrl: string;
  name: string;
  color?: string;
  size?: string;
  radius?: string;
  style?: any;
  component?: any;
}

export const UserAvatar = React.forwardRef<HTMLInputElement, UserAvatarProps>(
  ({ avatarUrl, name, ...props }: UserAvatarProps, ref) => {

    const getInitials = (name: string) => {
      const names = name?.split(' ');
      return names?.slice(0, 2).map(n => n[0]).join('');
    };

    return (
      avatarUrl ? (
        <Avatar
          ref={ref}
          src={avatarUrl}
          alt={name}
          radius="xl"
          {...props}
        />
      ) : (
        <Avatar ref={ref}
                {...props}>{getInitials(name)}</Avatar>
      )
    );
  },
);
