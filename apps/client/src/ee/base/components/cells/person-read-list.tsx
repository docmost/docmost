import clsx from "clsx";
import { UserRef } from "@/ee/base/types/base.types";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { BadgeOverflowList } from "@/ee/base/components/cells/badge-overflow";
import cellClasses from "@/ee/base/styles/cells.module.css";

type PersonReadListProps = {
  personIds: string[];
  users: Record<string, UserRef>;
};

export function PersonReadList({ personIds, users }: PersonReadListProps) {
  const entries = personIds.map((id) => ({
    id,
    name: users[id]?.name ?? id.substring(0, 8),
    avatarUrl: users[id]?.avatarUrl ?? "",
  }));
  const chips = entries.map((entry) => (
    <span
      key={entry.id}
      className={clsx(cellClasses.badge, cellClasses.personChip)}
    >
      <CustomAvatar
        avatarUrl={entry.avatarUrl}
        name={entry.name}
        size={16}
        radius="xl"
        style={{ flexShrink: 0 }}
      />
      <span className={cellClasses.personChipName}>{entry.name}</span>
    </span>
  ));
  return (
    <BadgeOverflowList
      chips={chips}
      measureKey={entries.map((e) => `${e.id}:${e.name}`).join("|")}
      tooltipLabel={entries.map((e) => e.name).join(", ")}
    />
  );
}
