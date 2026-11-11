import type {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_COLORS,
  ANNOUNCEMENT_TYPES,
} from "@/ee/announcement/announcement.constants";

export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

export type AnnouncementColor = (typeof ANNOUNCEMENT_COLORS)[number];

export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export type AnnouncementStatus = "scheduled" | "active" | "archived";

export type AnnouncementSurface = "app" | "public";

export type IAnnouncementMark =
  | { type: "bold" | "italic" | "underline" }
  | { type: "link"; attrs: { href: string } };

export type IAnnouncementText = {
  type: "text";
  text: string;
  marks?: IAnnouncementMark[];
};

export type IAnnouncementContent = {
  type: "doc";
  content: [{ type: "paragraph"; content: IAnnouncementText[] }];
};

export type IAnnouncementBanner = {
  id: string;
  type: AnnouncementType;
  color: AnnouncementColor;
  content: IAnnouncementContent;
  isDismissible: boolean;
  startsAt: string;
  endsAt: string | null;
};

export type IVisibleAnnouncements = {
  now: string;
  items: IAnnouncementBanner[];
};

// offsetMs is the server clock minus the local clock, taken when the response arrived
export type IVisibleBanners = {
  items: IAnnouncementBanner[];
  offsetMs: number;
};

export type IAnnouncement = IAnnouncementBanner & {
  title: string;
  audience: AnnouncementAudience;
  archivedAt: string | null;
  status: AnnouncementStatus;
  createdAt: string;
  updatedAt: string;
};

export type IAnnouncementInput = {
  title: string;
  type: AnnouncementType;
  color: AnnouncementColor;
  content: IAnnouncementContent;
  isDismissible: boolean;
  audience: AnnouncementAudience;
  startsAt: string | null;
  endsAt: string | null;
  replace?: boolean;
};

export type IAnnouncementIdInput = { announcementId: string };

export type IUpdateAnnouncementInput = IAnnouncementInput &
  IAnnouncementIdInput;

export type IAnnouncementLimitConflict = {
  from: string;
  to: string | null;
  announcements: { id: string; title: string }[];
};

export type IAnnouncementTakeover = { id: string; title: string; at: string };

export type IAnnouncementReplacement = {
  replaces: IAnnouncementTakeover[];
  replacedBy: IAnnouncementTakeover[];
};

export type IAnnouncementListParams = {
  cursor?: string;
  limit?: number;
  query?: string;
  archived?: boolean;
};
