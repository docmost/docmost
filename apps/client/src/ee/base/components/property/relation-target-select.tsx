import { useState } from "react";
import {
  Combobox,
  Input,
  InputBase,
  ScrollArea,
  Text,
  useCombobox,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconCheck, IconSearch, IconTable } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { AutoTooltipText } from "@/components/ui/auto-tooltip-text";
import { useRelationTargetsQuery } from "@/ee/base/queries/base-relation-query";
import {
  useHydrateResolvedPage,
  useResolvedPages,
} from "@/ee/base/queries/base-page-resolver-query";
import classes from "@/ee/base/styles/property.module.css";

type RelationTargetSelectProps = {
  value: string | null;
  onChange: (id: string) => void;
  portalTarget?: HTMLElement | null;
  disabled?: boolean;
};

export function RelationTargetSelect({
  value,
  onChange,
  portalTarget,
  disabled,
}: RelationTargetSelectProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 250);
  const { data: targets } = useRelationTargetsQuery(debouncedSearch, !disabled);
  const { pages } = useResolvedPages([value]);
  const current = value ? pages.get(value) : undefined;
  const hydrateResolvedPage = useHydrateResolvedPage();

  const combobox = useCombobox({
    onDropdownOpen: () => combobox.focusSearchInput(),
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      combobox.focusTarget();
      setSearch("");
    },
  });

  const handleOptionSubmit = (id: string) => {
    const target = targets?.find((item) => item.id === id);
    if (target) {
      hydrateResolvedPage({
        id: target.id,
        slugId: target.slugId,
        title: target.title,
        icon: target.icon,
        spaceId: target.spaceId,
        space: { id: target.spaceId, slug: target.spaceSlug, name: target.spaceName },
      });
    }
    onChange(id);
    combobox.closeDropdown();
  };

  return (
    <Combobox
      store={combobox}
      size="xs"
      onOptionSubmit={handleOptionSubmit}
      portalProps={{ target: portalTarget ?? undefined }}
    >
      <Combobox.Target withAriaAttributes={false}>
        <InputBase
          component="button"
          type="button"
          size="xs"
          label={t("Related base")}
          pointer
          disabled={disabled}
          rightSection={disabled ? undefined : <Combobox.Chevron size="xs" />}
          rightSectionPointerEvents="none"
          onClick={() => combobox.toggleDropdown()}
        >
          {!value ? (
            <Input.Placeholder>{t("Choose a base")}</Input.Placeholder>
          ) : current ? (
            <RelationTargetLabel
              title={current.title}
              icon={current.icon}
              spaceName={current.space?.name}
            />
          ) : current === null ? (
            <Text span size="xs" c="dimmed">
              {t("No access")}
            </Text>
          ) : null}
        </InputBase>
      </Combobox.Target>

      {!disabled && (
        <Combobox.Dropdown>
          <Combobox.Search
            value={search}
            onChange={(event) => {
              combobox.updateSelectedOptionIndex();
              setSearch(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              // Escape closes this list only, not the panel around it
              if (event.key === "Escape") event.stopPropagation();
            }}
            leftSection={<IconSearch size={14} />}
            placeholder={t("Search bases")}
            aria-label={t("Search bases")}
          />
          <Combobox.Options>
            {targets && targets.length > 0 && (
              <ScrollArea.Autosize
                mah={220}
                type="scroll"
                scrollbarSize="var(--combobox-padding)"
                offsetScrollbars="y"
              >
                {targets.map((target) => (
                  <Combobox.Option
                    value={target.id}
                    key={target.id}
                    active={target.id === value}
                  >
                    <RelationTargetLabel
                      title={target.title}
                      icon={target.icon}
                      spaceName={target.spaceName}
                      checked={target.id === value}
                    />
                  </Combobox.Option>
                ))}
              </ScrollArea.Autosize>
            )}
            {targets?.length === 0 && (
              <Combobox.Empty>{t("No bases found")}</Combobox.Empty>
            )}
          </Combobox.Options>
        </Combobox.Dropdown>
      )}
    </Combobox>
  );
}

function RelationTargetLabel({
  title,
  icon,
  spaceName,
  checked,
}: {
  title: string | null;
  icon: string | null;
  spaceName?: string;
  checked?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span className={classes.relationTarget}>
      <span className={classes.relationTargetIcon} aria-hidden>
        {icon || <IconTable size={14} />}
      </span>
      <AutoTooltipText
        span
        inherit
        className={classes.relationTargetTitle}
        tooltipProps={{ withinPortal: true }}
      >
        {title || t("Untitled")}
      </AutoTooltipText>
      {spaceName && (
        <AutoTooltipText
          span
          inherit
          c="dimmed"
          className={classes.relationTargetSpace}
          tooltipProps={{ withinPortal: true }}
        >
          {spaceName}
        </AutoTooltipText>
      )}
      {checked !== undefined && (
        <IconCheck
          size={14}
          className={clsx(
            classes.relationTargetCheck,
            checked && classes.relationTargetChecked,
          )}
        />
      )}
    </span>
  );
}
