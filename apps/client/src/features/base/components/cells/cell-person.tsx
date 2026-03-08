import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Popover } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
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

  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setSearch("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isEditing]);

  const { data: membersData } = useWorkspaceMembersQuery({ limit: 100 });
  const members = membersData?.items ?? [];
  const memberMap = useMemo(() => {
    const map = new Map<string, (typeof members)[0]>();
    for (const m of members) map.set(m.id, m);
    return map;
  }, [members]);

  const filteredMembers = search
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          (m.email && m.email.toLowerCase().includes(search.toLowerCase())),
      )
    : members;

  const handleAdd = useCallback(
    (memberId: string) => {
      if (personIds.includes(memberId)) return;
      onCommit([...personIds, memberId]);
    },
    [personIds, onCommit],
  );

  const handleRemove = useCallback(
    (memberId: string) => {
      const newIds = personIds.filter((id) => id !== memberId);
      onCommit(newIds.length > 0 ? newIds : null);
    },
    [personIds, onCommit],
  );

  const handleToggle = useCallback(
    (memberId: string) => {
      if (personIds.includes(memberId)) {
        handleRemove(memberId);
      } else {
        handleAdd(memberId);
      }
    },
    [personIds, handleAdd, handleRemove],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Backspace" && search === "" && personIds.length > 0) {
        e.preventDefault();
        handleRemove(personIds[personIds.length - 1]);
      }
    },
    [onCancel, search, personIds, handleRemove],
  );

  const selectedSet = new Set(personIds);

  if (isEditing) {
    return (
      <Popover
        opened
        onClose={onCancel}
        position="bottom-start"
        width={300}
        trapFocus
      >
        <Popover.Target>
          <div style={{ width: "100%", height: "100%" }}>
            <PersonReadList personIds={personIds} memberMap={memberMap} />
          </div>
        </Popover.Target>
        <Popover.Dropdown p={0}>
          {/* Tag input area */}
          <div className={cellClasses.personTagArea}>
            {personIds.map((id) => {
              const member = memberMap.get(id);
              const name = member?.name ?? id.substring(0, 8);
              return (
                <span key={id} className={cellClasses.personTag}>
                  <CustomAvatar
                    avatarUrl={member?.avatarUrl ?? ""}
                    name={name}
                    size={18}
                    radius="xl"
                  />
                  <span className={cellClasses.personTagName}>{name}</span>
                  <button
                    type="button"
                    className={cellClasses.personTagRemove}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(id);
                    }}
                  >
                    <IconX size={10} />
                  </button>
                </span>
              );
            })}
            <input
              ref={searchRef}
              className={cellClasses.personTagInput}
              placeholder={personIds.length === 0 ? "Search for a person..." : ""}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Dropdown */}
          <div className={cellClasses.personDropdownDivider} />
          <div className={cellClasses.personDropdownHint}>
            Select as many as you like
          </div>
          <div className={cellClasses.selectDropdown}>
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className={`${cellClasses.selectOption} ${
                  selectedSet.has(member.id) ? cellClasses.selectOptionActive : ""
                }`}
                onClick={() => handleToggle(member.id)}
              >
                <CustomAvatar
                  avatarUrl={member.avatarUrl}
                  name={member.name}
                  size={24}
                  radius="xl"
                />
                <span className={cellClasses.personOptionName}>
                  {member.name}
                </span>
              </div>
            ))}
            {filteredMembers.length === 0 && (
              <div className={cellClasses.personDropdownHint}>
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

  return <PersonReadList personIds={personIds} memberMap={memberMap} />;
}

function PersonReadList({
  personIds,
  memberMap,
}: {
  personIds: string[];
  memberMap: Map<
    string,
    { id: string; name: string; email?: string; avatarUrl?: string }
  >;
}) {
  return (
    <div className={cellClasses.personGroup}>
      {personIds.map((id) => {
        const member = memberMap.get(id);
        const name = member?.name ?? id.substring(0, 8);
        return (
          <div key={id} className={cellClasses.personRow}>
            <CustomAvatar
              avatarUrl={member?.avatarUrl ?? ""}
              name={name}
              size={20}
              radius="xl"
            />
            <span className={cellClasses.personName}>{name}</span>
          </div>
        );
      })}
    </div>
  );
}
