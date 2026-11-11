import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  type Icon,
} from "@tabler/icons-react";
import type {
  AnnouncementColor,
  AnnouncementType,
} from "./types/announcement.types";

export const ANNOUNCEMENT_TYPES = [
  "info",
  "success",
  "warning",
  "critical",
  "neutral",
] as const;

export const ANNOUNCEMENT_COLORS = [
  "blue",
  "green",
  "yellow",
  "red",
  "purple",
  "gray",
  "black",
] as const;

export const ANNOUNCEMENT_AUDIENCES = ["members", "everyone"] as const;

export const ANNOUNCEMENT_MAX_TITLE_LENGTH = 100;

export const ANNOUNCEMENT_MAX_TEXT_LENGTH = 500;

export const ANNOUNCEMENT_PREVIEW_LENGTH = 80;

export const ANNOUNCEMENT_MAX_VISIBLE = 1;

export const ANNOUNCEMENT_BANNERS_HEIGHT_VAR = "--announcement-banners-height";

export const ANNOUNCEMENT_TYPE_LABELS: Record<AnnouncementType, string> = {
  info: "Info",
  success: "Success",
  warning: "Warning",
  critical: "Critical",
  neutral: "Neutral",
};

export const ANNOUNCEMENT_TYPE_DEFAULT_COLOR: Record<
  AnnouncementType,
  AnnouncementColor
> = {
  info: "blue",
  success: "green",
  warning: "yellow",
  critical: "red",
  neutral: "gray",
};

export const ANNOUNCEMENT_TYPE_ICONS: Record<AnnouncementType, Icon | null> = {
  info: IconInfoCircle,
  success: IconCircleCheck,
  warning: IconAlertTriangle,
  critical: IconAlertOctagon,
  neutral: null,
};

export const ANNOUNCEMENT_COLOR_STYLES: Record<
  AnnouncementColor,
  { background: string; text: string; label: string }
> = {
  blue: { background: "#1971c2", text: "#ffffff", label: "Blue" },
  green: { background: "#2a7d3d", text: "#ffffff", label: "Green" },
  yellow: { background: "#fcc419", text: "#1a1b1e", label: "Yellow" },
  red: { background: "#c92a2a", text: "#ffffff", label: "Red" },
  purple: { background: "#6e5dc6", text: "#ffffff", label: "Purple" },
  gray: { background: "#dee2e6", text: "#1a1b1e", label: "Gray" },
  black: { background: "#111111", text: "#ffffff", label: "Black" },
};
