import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Popover } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import clsx from "clsx";
import {
  IBaseProperty,
  PersonTypeOptions,
} from "@/features/base/types/base.types";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import cellClasses from "@/features/base/styles/cells.module.css";
import { useListKeyboardNav } from "@/features/base/hooks/use-list-keyboard-nav";

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
  property,
  isEditing,
  onCommit,
  onCancel,
}: CellPersonProps) {
  const allowMultiple =
    (property.typeOptions as PersonTypeOptions)?.allowMultiple !== false;

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

  const { activeIndex, setActiveIndex, handleNavKey, setOptionRef } =
    useListKeyboardNav(filteredMembers.length, [search, isEditing]);

  const handleSelect = useCallback(
    (memberId: string) => {
      if (allowMultiple) {
        // Multi mode: toggle add/remove
        if (personIds.includes(memberId)) {
          const newIds = personIds.filter((id) => id !== memberId);
          onCommit(newIds.length > 0 ? newIds : null);
        } else {
          onCommit([...personIds, memberId]);
        }
      } else {
        // Single mode: replace or clear
        if (personIds.includes(memberId)) {
          onCommit(null);
        } else {
          onCommit(memberId);
        }
      }
    },
    [allowMultiple, personIds, onCommit],
  );

  const handleRemove = useCallback(
    (memberId: string) => {
      if (allowMultiple) {
        const newIds = personIds.filter((id) => id !== memberId);
        onCommit(newIds.length > 0 ? newIds : null);
      } else {
        onCommit(null);
      }
    },
    [allowMultiple, personIds, onCommit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (handleNavKey(e)) return;
      if (e.key === "Enter") {
        if (activeIndex < 0 || activeIndex >= filteredMembers.length) return;
        e.preventDefault();
        handleSelect(filteredMembers[activeIndex].id);
        return;
      }
      if (e.key === "Backspace" && search === "" && personIds.length > 0) {
        e.preventDefault();
        handleRemove(personIds[personIds.length - 1]);
      }
    },
    [onCancel, handleNavKey, activeIndex, filteredMembers, handleSelect, search, personIds, handleRemove],
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
          {allowMultiple && (
            <div className={cellClasses.personDropdownHint}>
              Select as many as you like
            </div>
          )}
          <div className={cellClasses.selectDropdown}>
            {filteredMembers.map((member, idx) => {
              const isSelected = selectedSet.has(member.id);
              return (
                <div
                  key={member.id}
                  ref={setOptionRef(idx)}
                  className={clsx(
                    cellClasses.selectOption,
                    isSelected && cellClasses.selectOptionActive,
                    idx === activeIndex && cellClasses.selectOptionKeyboardActive,
                  )}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => {
                    // Keep focus on the search input so click doesn't blur + close popover.
                    e.preventDefault();
                  }}
                  onClick={() => handleSelect(member.id)}
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
              );
            })}
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
