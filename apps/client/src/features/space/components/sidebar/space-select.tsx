import { useEffect, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import {
  type ComboboxItem,
  type MultiSelectProps,
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

interface MultipleSpaceSelectProps extends Pick<
  MultiSelectProps,
  "id" | "label" | "aria-label" | "description" | "autoFocus" | "placeholder"
> {
  multiple: true;
  value: string[];
  onChange: (values: string[]) => void;
  unavailableLabel?: string;
  scopes?: (ComboboxItem & { spaceId?: string; logo?: string })[];
  maxValues: number;
  withinPortal?: boolean;
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
  space?: SpaceIcon;
  unavailableLabel?: string;
  onRemove: () => void;
}

function SpacePill({
  token,
  space,
  unavailableLabel,
  onRemove,
}: SpacePillProps) {
  const { t } = useTranslation();
  const label = space?.name ?? unavailableLabel ?? token;
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
  const { data: space } = useUnlistedSpaceQuery(pill.token, listedSpaces);
  return <SpacePill {...pill} space={space} />;
}

export function SpaceSelect(
  props: SingleSpaceSelectProps | MultipleSpaceSelectProps,
) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const search = props.multiple ? searchValue.trim() : searchValue;
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
    const scopes = (props.scopes ?? []).map(
      ({ value, label, spaceId, logo }) => {
        const listed = spaceId ? knownSpaces.get(spaceId) : undefined;
        return {
          id: value,
          name: listed?.name ?? label,
          logo: listed?.logo ?? logo,
          spaceId,
        };
      },
    );
    // A relative scope and the space it resolves to share one choice.
    const choices = [
      ...scopes.filter(
        ({ spaceId }) => !spaceId || !props.value.includes(spaceId),
      ),
      ...(spaces?.items ?? []).filter(
        ({ id }) => !scopes.some((scope) => scope.spaceId === id),
      ),
    ].map(({ id, name, logo }) => ({
      value: id,
      label: name,
      name,
      logo,
    }));

    return (
      <MultiSelect
        {...commonProps}
        id={props.id}
        aria-label={props["aria-label"]}
        autoFocus={props.autoFocus}
        label={props.label}
        description={props.description}
        inputWrapperOrder={["label", "input", "description", "error"]}
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
          const space =
            knownSpaces.get(value) ??
            scopes.find(
              (scope) => scope.id === value || scope.spaceId === value,
            );
          const pill = {
            token: value,
            space,
            onRemove,
            unavailableLabel: props.unavailableLabel,
          };
          if (
            !space &&
            spaces &&
            props.value.length <= props.maxValues &&
            isUuid(value)
          ) {
            return <UnlistedSpacePill {...pill} listedSpaces={spaces.items} />;
          }
          return <SpacePill {...pill} />;
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
