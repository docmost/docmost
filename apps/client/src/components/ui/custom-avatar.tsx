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

// `color.shade` pairs whose contrast meets WCAG AA (4.5:1) in BOTH variants:
//   - filled: white text on the shade as bg
//   - light:  shade as text on the color's light-bg (10% color.6 over white)
// Avoids lime/yellow/green/orange — even their dark shades have weak
// contrast. grape and indigo were bumped from .7 to darker shades because
// the original picks failed: grape.7 was 4.02/3.61 (both fail) and
// indigo.7 was 4.98/4.39 (light fails by a hair).
const SAFE_INITIALS_COLORS: MantineColor[] = [
  "blue.8",
  "cyan.9",
  "grape.9",
  "indigo.8",
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

function sanitizeInitialsSource(name: string) {
  const sanitized = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  return sanitized || name;
}

export const CustomAvatar = React.forwardRef<
  HTMLInputElement,
  CustomAvatarProps
>(({ avatarUrl, name, type, color, ...props }: CustomAvatarProps, ref) => {
  const avatarLink = getAvatarUrl(avatarUrl, type);
  const resolvedColor =
    !color || color === "initials" ? pickInitialsColor(name ?? "") : color;
  const initialsSource = sanitizeInitialsSource(name ?? "");

  return (
    <Avatar
      ref={ref}
      src={avatarLink}
      name={initialsSource}
      alt={name}
      color={resolvedColor}
      {...props}
    />
  );
});
