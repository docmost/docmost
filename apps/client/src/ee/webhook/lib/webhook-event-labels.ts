import type { WebhookEvent } from "@/ee/webhook/types/webhook.types";

export const EVENT_GROUPS: { group: string; events: WebhookEvent[] }[] = [
  {
    group: "Pages",
    events: [
      "page.created",
      "page.updated",
      "page.moved",
      "page.deleted",
      "page.restored",
    ],
  },
  {
    group: "Comments",
    events: [
      "comment.created",
      "comment.updated",
      "comment.deleted",
      "comment.resolved",
    ],
  },
  {
    group: "Spaces",
    events: ["space.created", "space.updated", "space.deleted"],
  },
  {
    group: "Attachments",
    events: ["attachment.uploaded"],
  },
  {
    group: "Members",
    events: ["user.created", "user.deactivated"],
  },
];

export const eventLabel = (event: string): string => event;

export const multiSelectData = () =>
  EVENT_GROUPS.map(({ group, events }) => ({
    group,
    items: events.map((e) => ({ value: e, label: e })),
  }));
