import React from "react";
import { Avatar, MantineColor } from "@mantine/core";
import { getAvatarUrl } from "@/lib/config.ts";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";

interface CustomAvatarProps {
  avatarUrl?: string;
  name: string;
  color?: string;
  size?: string | number;
  radius?: string | number;
  variant?: string;
  style?: any;
  component?: any;
  type?: AvatarIconType;
  mt?: string | number;
}

// `color.shade` pairs whose filled background meets WCAG AA (4.5:1) against
// white text. Avoids lime/yellow/green/orange — even their dark shades have
// weak white-text contrast.
const SAFE_INITIALS_COLORS: MantineColor[] = [
  "blue.8",
  "cyan.9",
  "grape.7",
  "indigo.7",
  "pink.8",
  "red.8",
  "violet.7",
];

function hashName(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickInitialsColor(name: string) {
  return SAFE_INITIALS_COLORS[hashName(name) % SAFE_INITIALS_COLORS.length];
}

export const CustomAvatar = React.forwardRef<
  HTMLInputElement,
  CustomAvatarProps
>(({ avatarUrl, name, type, color, ...props }: CustomAvatarProps, ref) => {
  const avatarLink = getAvatarUrl(avatarUrl, type);
  const resolvedColor =
    !color || color === "initials" ? pickInitialsColor(name ?? "") : color;

  return (
    <Avatar
      ref={ref}
      src={avatarLink}
      name={name}
      alt={name}
      color={resolvedColor}
      {...props}
    />
  );
});
