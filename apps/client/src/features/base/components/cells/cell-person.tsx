import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Popover, TextInput } from "@mantine/core";
import { IBaseProperty } from "@/features/base/types/base.types";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import cellClasses from "@/features/base/styles/cells.module.css";

type CellPersonProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

export function CellPerson({
  value,
  isEditing,
  onCommit,
  onCancel,
}: CellPersonProps) {
  const personIds = Array.isArray(value)
    ? (value as string[])
    : typeof value === "string"
      ? [value]
      : [];
  const selectedSet = new Set(personIds);

  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setSearch("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isEditing]);

  // Fetch members for display (always) and search (when editing)
  const { data: membersData } = useWorkspaceMembersQuery({ limit: 100 });
  const members = membersData?.items ?? [];
  const memberMap = useMemo(() => {
    const map = new Map<string, (typeof members)[0]>();
    for (const m of members) map.set(m.id, m);
    return map;
  }, [members]);

  // Filtered members for editing
  const filteredMembers = search
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          (m.email && m.email.toLowerCase().includes(search.toLowerCase())),
      )
    : members;

  const handleToggle = useCallback(
    (memberId: string) => {
      const newIds = selectedSet.has(memberId)
        ? personIds.filter((id) => id !== memberId)
        : [...personIds, memberId];
      onCommit(newIds.length > 0 ? newIds : null);
    },
    [personIds, selectedSet, onCommit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [onCancel],
  );

  const MAX_VISIBLE = 4;

  if (isEditing) {
    return (
      <Popover
        opened
        onClose={onCancel}
        position="bottom-start"
        width={260}
        trapFocus
      >
        <Popover.Target>
          <div style={{ width: "100%", height: "100%" }}>
            <PersonAvatarList
              personIds={personIds}
              memberMap={memberMap}
              maxVisible={MAX_VISIBLE}
            />
          </div>
        </Popover.Target>
        <Popover.Dropdown p={4}>
          <TextInput
            ref={searchRef}
            size="xs"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            mb={4}
          />
          <div className={cellClasses.selectDropdown}>
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className={`${cellClasses.selectOption} ${
                  selectedSet.has(member.id)
                    ? cellClasses.selectOptionActive
                    : ""
                }`}
                onClick={() => handleToggle(member.id)}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <CustomAvatar
                    avatarUrl={member.avatarUrl}
                    name={member.name}
                    size={22}
                    radius="xl"
                  />
                  <div style={{ overflow: "hidden" }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {member.name}
                    </div>
                    {member.email && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--mantine-color-dimmed)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {member.email}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredMembers.length === 0 && (
              <div
                style={{
                  padding: "8px 12px",
                  fontSize: 12,
                  color: "var(--mantine-color-dimmed)",
                }}
              >
                No members found
              </div>
            )}
          </div>
        </Popover.Dropdown>
      </Popover>
    );
  }

  if (personIds.length === 0) {
    return <span className={cellClasses.emptyValue} />;
  }

  return (
    <PersonAvatarList
      personIds={personIds}
      memberMap={memberMap}
      maxVisible={MAX_VISIBLE}
    />
  );
}

function PersonAvatarList({
  personIds,
  memberMap,
  maxVisible,
}: {
  personIds: string[];
  memberMap: Map<
    string,
    { id: string; name: string; email?: string; avatarUrl?: string }
  >;
  maxVisible: number;
}) {
  const visible = personIds.slice(0, maxVisible);
  const overflow = personIds.length - maxVisible;

  return (
    <div className={cellClasses.personGroup}>
      {visible.map((id) => {
        const member = memberMap.get(id);
        const name = member?.name ?? id.substring(0, 2);
        return (
          <CustomAvatar
            key={id}
            avatarUrl={member?.avatarUrl ?? ""}
            name={name}
            size={22}
            radius="xl"
          />
        );
      })}
      {overflow > 0 && (
        <span className={cellClasses.overflowCount}>+{overflow}</span>
      )}
    </div>
  );
}
