export type AnnouncementKind =
  | "info"
  | "success"
  | "warning"
  | "critical"
  | "neutral";

export type AnnouncementColor =
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple"
  | "gray"
  | "black";

export type AnnouncementAudience = "members" | "everyone";

export type AnnouncementStatus = "scheduled" | "active" | "ended" | "archived";

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
  kind: AnnouncementKind;
  color: AnnouncementColor;
  content: IAnnouncementContent;
  isDismissible: boolean;
  startsAt: string;
  endsAt: string | null;
};

export type IAnnouncement = IAnnouncementBanner & {
  audience: AnnouncementAudience;
  archivedAt: string | null;
  status: AnnouncementStatus;
  createdAt: string;
  updatedAt: string;
};

export type IAnnouncementInput = {
  kind: AnnouncementKind;
  color: AnnouncementColor;
  content: IAnnouncementContent;
  isDismissible: boolean;
  audience: AnnouncementAudience;
  startsAt: string | null;
  endsAt: string | null;
};

export type IAnnouncementIdInput = { announcementId: string };

export type IUpdateAnnouncementInput = IAnnouncementInput &
  IAnnouncementIdInput;

export type IAnnouncementLimitConflict = {
  from: string;
  to: string | null;
  announcements: { id: string; preview: string }[];
};

export type IAnnouncementArchivedParams = {
  cursor?: string;
  limit?: number;
};
