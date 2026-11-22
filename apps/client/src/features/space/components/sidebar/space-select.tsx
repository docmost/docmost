import { useEffect, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import {
  type ComboboxItem,
  Group,
  MultiSelect,
  Pill,
  Select,
  Text,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import { replaceEqualDeep } from "@tanstack/react-query";
import { validate as isUuid } from "uuid";
import {
  useGetSpacesQuery,
  useUnlistedSpaceQuery,
} from "@/features/space/queries/space-query";
import type { ISpace } from "@/features/space/types/space.types";
import { SpaceAvatar } from "../space-avatar";

type SpaceIcon = Pick<ISpace, "name" | "logo">;

interface SingleSpaceSelectProps {
  multiple?: false;
  onChange: (space: ISpace) => void;
  value?: string;
  label?: string;
  width?: number;
  opened?: boolean;
  clearable?: boolean;
  withinPortal?: boolean;
}

interface MultipleSpaceSelectProps {
  multiple: true;
  value: string[];
  onChange: (values: string[]) => void;
  label: string;
  placeholder?: string;
  unavailableLabel?: string;
  scopes?: ComboboxItem[];
  withOperators?: boolean;
  maxValues: number;
  withinPortal?: boolean;
}

function operator(value: string, enabled: boolean) {
  return enabled && /^[+-]/.test(value) ? value[0] : "";
}

function renderSpaceOption({
  option,
}: {
  option: ComboboxItem & Partial<SpaceIcon>;
}) {
  return (
    <Group gap="sm" wrap="nowrap">
      <SpaceAvatar name={option.name ?? option.label} logo={option.logo} />
      <Text size="sm" lineClamp={1}>
        {option.label}
      </Text>
    </Group>
  );
}

interface SpacePillProps {
  token: string;
  prefix: string;
  space?: SpaceIcon;
  unavailableLabel?: string;
  onRemove: () => void;
}

function SpacePill({
  token,
  prefix,
  space,
  unavailableLabel,
  onRemove,
}: SpacePillProps) {
  const { t } = useTranslation();
  const label = space ? prefix + space.name : (unavailableLabel ?? token);
  return (
    <Pill
      withRemoveButton
      onRemove={onRemove}
      removeButtonProps={{
        "aria-hidden": false,
        "aria-label": t("Remove {{name}}", { name: label }),
        tabIndex: 0,
      }}
    >
      {space ? (
        <Group component="span" gap={4} wrap="nowrap">
          <SpaceAvatar name={space.name} logo={space.logo} />
          <Text component="span" inherit truncate>
            {label}
          </Text>
        </Group>
      ) : (
        label
      )}
    </Pill>
  );
}

function UnlistedSpacePill({
  listedSpaces,
  ...pill
}: SpacePillProps & { listedSpaces: ISpace[] }) {
  const { data: space } = useUnlistedSpaceQuery(
    pill.token.slice(pill.prefix.length),
    listedSpaces,
  );
  return <SpacePill {...pill} space={space} />;
}

export function SpaceSelect(
  props: SingleSpaceSelectProps | MultipleSpaceSelectProps,
) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const withOperators = props.multiple && props.withOperators;
  const prefix = operator(searchValue, withOperators);
  const search = props.multiple
    ? searchValue.slice(prefix.length).trim()
    : searchValue;
  const [debouncedQuery] = useDebouncedValue(
    search,
    props.multiple ? 250 : 500,
  );
  const { data: spaces } = useGetSpacesQuery({
    query: debouncedQuery,
    limit: 50,
    ...(props.multiple && { status: "active" }),
  });

  // Keep selections available when the next search replaces the current page.
  const [previousSpaces, setPreviousSpaces] = useState(
    new Map<string, ISpace>(),
  );
  useEffect(() => {
    if (!spaces?.items.length) return;
    setPreviousSpaces((previous) => {
      const changed = spaces.items.filter((space) => {
        const cached = previous.get(space.id);
        return replaceEqualDeep(cached, space) !== cached;
      });
      if (!changed.length) return previous;
      const next = new Map(previous);
      changed.forEach((space) => next.set(space.id, space));
      return next;
    });
  }, [spaces]);
  const knownSpaces = new Map(previousSpaces);
  spaces?.items.forEach((space) => knownSpaces.set(space.id, space));

  const commonProps = {
    searchable: true,
    searchValue,
    onSearchChange: setSearchValue,
    renderOption: renderSpaceOption,
    nothingFoundMessage: t("No space found"),
    maxDropdownHeight: 300,
  };

  if (props.multiple === true) {
    const scopes: Pick<ISpace, "id" | "name" | "logo">[] = (
      props.scopes ?? []
    ).map(({ value, label }) => ({ id: value, name: label }));
    const choices = [...scopes, ...(spaces?.items ?? [])].map(
      ({ id, name, logo }) => ({
        value: prefix + id,
        label: prefix + name,
        name,
        logo,
      }),
    );

    return (
      <MultiSelect
        {...commonProps}
        label={props.label}
        placeholder={props.placeholder}
        hidePickedOptions
        data={choices}
        value={props.value}
        onChange={props.onChange}
        maxValues={props.maxValues}
        filter={({ options }) =>
          options.filter(
            (option) =>
              "label" in option &&
              option.label.toLowerCase().includes(search.toLowerCase()),
          )
        }
        renderPill={({ value, onRemove }) => {
          const prefix = operator(value, withOperators);
          const id = value.slice(prefix.length);
          const space =
            knownSpaces.get(id) ?? scopes.find((scope) => scope.id === id);
          const pill = {
            token: value,
            prefix,
            onRemove,
            unavailableLabel: props.unavailableLabel,
          };
          if (
            !space &&
            spaces &&
            props.value.length <= props.maxValues &&
            isUuid(id)
          ) {
            return <UnlistedSpacePill {...pill} listedSpaces={spaces.items} />;
          }
          return <SpacePill {...pill} space={space} />;
        }}
        comboboxProps={{ withinPortal: props.withinPortal }}
      />
    );
  }

  const choices = Array.from(knownSpaces.values()).filter(
    (space) => space.slug !== props.value,
  );
  return (
    <Select
      {...commonProps}
      data={choices.map(({ slug, name, logo }) => ({
        value: slug,
        label: name,
        logo,
      }))}
      placeholder={t("Search for spaces")}
      clearable={props.clearable}
      variant="filled"
      onChange={(slug) => {
        const space = choices.find((space) => space.slug === slug);
        if (space) props.onChange(space);
      }}
      onClick={(event) => event.stopPropagation()}
      limit={50}
      checkIconPosition="right"
      comboboxProps={{
        width: props.width,
        withinPortal: props.withinPortal ?? true,
        position: "bottom",
        keepMounted: false,
        dropdownPadding: 0,
      }}
      dropdownOpened={props.opened}
    />
  );
}
