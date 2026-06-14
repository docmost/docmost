import { useState, useRef, useEffect, useCallback } from "react";
import { Popover, InputBase, Input } from "@mantine/core";
import { IconX, IconChevronDown } from "@tabler/icons-react";
import clsx from "clsx";
import {
  usePersonSearch,
  type PersonSuggestion,
} from "@/ee/base/hooks/use-person-search";
import {
  useReferenceStore,
  useHydrateUsers,
} from "@/ee/base/reference/reference-store";
import { useListKeyboardNav } from "@/ee/base/hooks/use-list-keyboard-nav";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import cellClasses from "@/ee/base/styles/cells.module.css";

type FilterPersonInputProps = {
  pageId: string;
  multiple: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
  placeholder: string;
  label?: string;
  w?: number | string;
  portalTarget?: HTMLElement | null;
};

function toIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => !!v);
  if (typeof value === "string" && value) return [value];
  return [];
}

export function FilterPersonInput({
  pageId,
  multiple,
  value,
  onChange,
  placeholder,
  label,
  w,
  portalTarget,
}: FilterPersonInputProps) {
  const ids = toIds(value);
  const selectedSet = new Set(ids);

  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const store = useReferenceStore(pageId);
  const hydrateUsers = useHydrateUsers(pageId);
  const suggestions = usePersonSearch(search, opened);

  useEffect(() => {
    if (opened) requestAnimationFrame(() => searchRef.current?.focus());
    else setSearch("");
  }, [opened]);

  const filtered: PersonSuggestion[] = multiple
    ? suggestions.filter((s) => !selectedSet.has(s.id))
    : suggestions;

  const { activeIndex, setActiveIndex, handleNavKey, setOptionRef } =
    useListKeyboardNav(filtered.length, [search, opened]);

  const emit = useCallback(
    (nextIds: string[]) => {
      if (multiple) onChange(nextIds.length > 0 ? nextIds : undefined);
      else onChange(nextIds[0] ?? undefined);
    },
    [multiple, onChange],
  );

  const handleSelect = useCallback(
    (id: string) => {
      const picked = suggestions.find((s) => s.id === id);
      if (picked)
        hydrateUsers([
          { id: picked.id, name: picked.name, avatarUrl: picked.avatarUrl },
        ]);
      if (multiple) {
        emit(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
      } else {
        emit([id]);
        setOpened(false);
      }
      setSearch("");
    },
    [suggestions, hydrateUsers, multiple, ids, emit],
  );

  const handleRemove = useCallback(
    (id: string) => emit(ids.filter((x) => x !== id)),
    [emit, ids],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpened(false);
        return;
      }
      if (handleNavKey(e)) return;
      if (e.key === "Enter") {
        if (activeIndex < 0 || activeIndex >= filtered.length) return;
        e.preventDefault();
        handleSelect(filtered[activeIndex].id);
        return;
      }
      if (e.key === "Backspace" && search === "" && ids.length > 0) {
        e.preventDefault();
        handleRemove(ids[ids.length - 1]);
      }
    },
    [handleNavKey, activeIndex, filtered, handleSelect, search, ids, handleRemove],
  );

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width={260}
      withinPortal={!!portalTarget}
      portalProps={{ target: portalTarget ?? undefined }}
      closeOnEscape={false}
      closeOnClickOutside
    >
      <Popover.Target>
        <InputBase
          component="button"
          type="button"
          size="xs"
          pointer
          multiline
          w={w ?? 170}
          label={label}
          rightSection={<IconChevronDown size={14} />}
          rightSectionPointerEvents="none"
          onClick={() => setOpened((o) => !o)}
        >
          {ids.length === 0 ? (
            <Input.Placeholder>{placeholder}</Input.Placeholder>
          ) : (
            <span className={cellClasses.filterTriggerChips}>
              {ids.map((id) => {
                const user = store.users[id];
                const name = user?.name ?? id.substring(0, 8);
                return (
                  <span key={id} className={cellClasses.filterTriggerChip}>
                    <CustomAvatar
                      avatarUrl={user?.avatarUrl ?? ""}
                      name={name}
                      size={16}
                      radius="xl"
                    />
                    <span className={cellClasses.filterTriggerChipName}>
                      {name}
                    </span>
                  </span>
                );
              })}
            </span>
          )}
        </InputBase>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <div className={cellClasses.personTagArea}>
          {multiple &&
            ids.map((id) => {
              const user = store.users[id];
              const name = user?.name ?? id.substring(0, 8);
              return (
                <span key={id} className={cellClasses.personTag}>
                  <CustomAvatar
                    avatarUrl={user?.avatarUrl ?? ""}
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
            placeholder="Find a user..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className={cellClasses.personDropdownDivider} />
        <div className={cellClasses.selectDropdown}>
          {filtered.map((member, idx) => (
            <div
              key={member.id}
              ref={setOptionRef(idx)}
              className={clsx(
                cellClasses.selectOption,
                selectedSet.has(member.id) && cellClasses.selectOptionActive,
                idx === activeIndex && cellClasses.selectOptionKeyboardActive,
              )}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => handleSelect(member.id)}
            >
              <CustomAvatar
                avatarUrl={member.avatarUrl ?? ""}
                name={member.name ?? ""}
                size={24}
                radius="xl"
              />
              <div className={cellClasses.personOptionText}>
                <span className={cellClasses.personOptionName}>
                  {member.name ?? ""}
                </span>
                {member.email && (
                  <span className={cellClasses.personOptionEmail}>
                    {member.email}
                  </span>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className={cellClasses.personDropdownHint}>No users found</div>
          )}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
