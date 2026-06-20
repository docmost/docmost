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

// color.shade picks whose FILLED variant (white text on the shade) meets WCAG AA 4.5:1.
// Avoids lime/yellow/green/orange, too light even at dark shades.
// For non-filled variants, initials text is forced to the .9 shade at render time:
// Mantine otherwise caps light-variant placeholder text at .6, dropping contrast to ~3:1.
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
>(({ avatarUrl, name, type, color, variant, ...props }: CustomAvatarProps, ref) => {
  const avatarLink = getAvatarUrl(avatarUrl, type);
  const isInitials = !color || color === "initials";
  const pickedColor = isInitials ? pickInitialsColor(name ?? "") : color;
  const hue = pickedColor.split(".")[0];
  const initialsSource = sanitizeInitialsSource(name ?? "");

  const resolvedColor = variant === "filled" ? pickedColor : hue;

  const placeholderStyles =
    isInitials && variant !== "filled"
      ? {
          placeholder: {
            color: `var(--mantine-color-${hue}-9)`,
          },
        }
      : undefined;

  return (
    <Avatar
      ref={ref}
      src={avatarLink}
      name={initialsSource}
      alt={name}
      color={resolvedColor}
      variant={variant}
      styles={placeholderStyles}
      {...props}
    />
  );
});
