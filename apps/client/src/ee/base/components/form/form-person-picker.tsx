import { useEffect, useState } from "react";
import {
  Combobox,
  Pill,
  PillsInput,
  Text,
  useCombobox,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { UserRef } from "@/ee/base/types/base.types";
import {
  PersonSuggestion,
  usePersonSearch,
} from "@/ee/base/hooks/use-person-search";
import { AUTOFILL_OPT_OUT } from "@/ee/base/components/form/form-definition";
import classes from "@/ee/base/styles/form.module.css";

type FormPersonPickerProps = {
  value: unknown;
  allowMultiple: boolean;
  onChange: (value: unknown) => void;
  knownUsers?: Record<string, UserRef>;
  controlId: string;
  ariaLabelledBy: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
  required?: boolean;
};

export function FormPersonPicker({
  value,
  allowMultiple,
  onChange,
  knownUsers,
  controlId,
  ariaLabelledBy,
  ariaDescribedBy,
  invalid,
  required,
}: FormPersonPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, UserRef>>({});
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      setSearch("");
    },
  });
  const results = usePersonSearch(search, combobox.dropdownOpened);
  const [settledSearch] = useDebouncedValue(search, 250);
  const searchSettled = search.trim() === settledSearch.trim();

  useEffect(() => {
    if (searchSettled && search.trim() && results.length > 0) {
      combobox.selectFirstOption();
    }
  }, [searchSettled, search, results]);

  const selectedIds = Array.isArray(value)
    ? (value as string[])
    : typeof value === "string"
      ? [value]
      : [];

  const select = (user: PersonSuggestion) => {
    setPicked((prev) => ({
      ...prev,
      [user.id]: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
    }));
    if (!allowMultiple) {
      onChange(user.id);
      combobox.closeDropdown();
      return;
    }
    onChange(
      selectedIds.includes(user.id)
        ? selectedIds.filter((id) => id !== user.id)
        : [...selectedIds, user.id],
    );
    combobox.resetSelectedOption();
    setSearch("");
  };

  const remove = (userId: string) =>
    onChange(
      allowMultiple ? selectedIds.filter((id) => id !== userId) : null,
    );

  return (
    <Combobox
      store={combobox}
      withinPortal
      shadow="md"
      radius="md"
      onOptionSubmit={(userId) => {
        const user = results.find((u) => u.id === userId);
        if (user) select(user);
      }}
    >
      <Combobox.DropdownTarget>
        <PillsInput
          size="sm"
          radius="md"
          classNames={{ wrapper: classes.field, input: classes.input }}
          error={invalid}
          onClick={() => combobox.openDropdown()}
        >
          <Pill.Group>
            {selectedIds.map((userId) => {
              const user = picked[userId] ?? knownUsers?.[userId];
              const name = user?.name || userId.substring(0, 8);
              return (
                <Pill
                  key={userId}
                  size="sm"
                  withRemoveButton
                  className={classes.personPill}
                  onRemove={() => remove(userId)}
                >
                  <span className={classes.personPillLabel}>
                    <CustomAvatar
                      avatarUrl={user?.avatarUrl ?? ""}
                      name={name}
                      size={18}
                      radius="xl"
                    />
                    {name}
                  </span>
                </Pill>
              );
            })}
            <Combobox.EventsTarget>
              <PillsInput.Field
                {...AUTOFILL_OPT_OUT}
                id={controlId}
                value={search}
                placeholder={
                  selectedIds.length > 0
                    ? undefined
                    : allowMultiple
                      ? t("Search people")
                      : t("Search for a person")
                }
                aria-labelledby={ariaLabelledBy}
                aria-describedby={ariaDescribedBy}
                aria-required={required || undefined}
                aria-invalid={invalid || undefined}
                onFocus={() => combobox.openDropdown()}
                onBlur={() => combobox.closeDropdown()}
                onChange={(event) => {
                  combobox.openDropdown();
                  combobox.resetSelectedOption();
                  setSearch(event.currentTarget.value);
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Backspace" &&
                    search.length === 0 &&
                    selectedIds.length > 0
                  ) {
                    event.preventDefault();
                    remove(selectedIds[selectedIds.length - 1]);
                  }
                }}
              />
            </Combobox.EventsTarget>
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown hidden={results.length === 0 && !searchSettled}>
        <Combobox.Options className={classes.personOptions}>
          {results.length === 0 ? (
            <Combobox.Empty>{t("No people found")}</Combobox.Empty>
          ) : (
            results.map((user) => {
              const selected = selectedIds.includes(user.id);
              const name = user.name || user.email || "";
              return (
                <Combobox.Option
                  key={user.id}
                  value={user.id}
                  active={selected}
                  className={classes.personOption}
                >
                  <CustomAvatar
                    avatarUrl={user.avatarUrl ?? ""}
                    name={name}
                    size={26}
                    radius="xl"
                  />
                  <div className={classes.personOptionText}>
                    <Text size="sm" truncate>
                      {name}
                    </Text>
                    {user.name && user.email && (
                      <Text size="xs" c="dimmed" truncate>
                        {user.email}
                      </Text>
                    )}
                  </div>
                  {selected && <IconCheck size={16} />}
                </Combobox.Option>
              );
            })
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
