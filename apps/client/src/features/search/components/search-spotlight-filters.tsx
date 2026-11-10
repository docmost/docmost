import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import cx from "clsx";
import {
  Button,
  Menu,
  Text,
  Badge,
  Group,
  ScrollArea,
  Switch,
  getDefaultZIndex,
} from "@mantine/core";
import {
  IconChevronDown,
  IconBuilding,
  IconPlus,
  IconFileDescription,
  IconCheck,
  IconUser,
  IconTag,
  IconLetterCase,
  IconArchive,
  IconX,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  useGetSpacesQuery,
  useUnlistedSpaceQuery,
} from "@/features/space/queries/space-query";
import { includeSpace } from "@/features/space/space.utils";
import { SpaceFilterMenu } from "@/features/space/components/space-filter-menu";
import { CreatorFilterMenu } from "@/features/search/components/creator-filter-menu";
import { RadioMenuItem } from "@/components/ui/radio-menu-item";
import { CheckboxMenuItem } from "@/components/ui/checkbox-menu-item";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import classes from "./search-spotlight-filters.module.css";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { LabelFilterMenu } from "./label-filter-menu";

interface SearchSpotlightFiltersProps {
  onFiltersChange?: (filters: any) => void;
  onAskClick?: () => void;
  spaceId?: string;
  isAiMode?: boolean;
}

export function SearchSpotlightFilters({
  onFiltersChange,
  onAskClick,
  spaceId,
  isAiMode = false,
}: SearchSpotlightFiltersProps) {
  const { t } = useTranslation();
  const hasAttachmentIndexing = useHasFeature(Feature.ATTACHMENT_INDEXING);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(
    spaceId || null
  );
  const [contentType, setContentType] = useState<string | null>("page");
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [selectedCreatorName, setSelectedCreatorName] = useState<string | null>(
    null
  );
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [titleOnly, setTitleOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const filterMenuTargetRef = useRef<HTMLButtonElement>(null);
  const [openedFilter, setOpenedFilter] = useState<string | null>(null);
  const [visibleFilters, setVisibleFilters] = useState<string[]>([]);
  const [workspace] = useAtom(workspaceAtom);

  const { data: spacesData } = useGetSpacesQuery({ limit: 100 });
  const { data: selectedSpace } = useUnlistedSpaceQuery(
    selectedSpaceId,
    spacesData?.items,
  );
  const selectedSpaceData = selectedSpaceId
    ? includeSpace(spacesData?.items ?? [], selectedSpace).find(
        (space) => space.id === selectedSpaceId,
      )
    : null;
  const spaceArchived = !!selectedSpaceData?.archivedAt;

  const contentTypeOptions = [
    { value: "page", label: t("Pages") },
    {
      value: "attachment",
      label: t("Attachments"),
      disabled: !hasAttachmentIndexing,
    },
  ];

  useEffect(() => {
    onFiltersChange?.({
      spaceId: selectedSpaceId,
      spaceArchived,
      contentType,
      creatorId: selectedCreatorId,
      labelIds: selectedLabelIds,
      titleOnly,
      includeArchived,
    });
  }, [
    selectedSpaceId,
    spaceArchived,
    contentType,
    selectedCreatorId,
    selectedLabelIds,
    titleOnly,
    includeArchived,
    onFiltersChange,
  ]);

  // the chip can push the open menu's target out of the scrolled row
  useLayoutEffect(() => {
    if (includeArchived) {
      filterMenuTargetRef.current?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [includeArchived]);

  const handleSpaceSelect = (spaceId: string | null) => {
    setSelectedSpaceId(spaceId);
  };

  const handleCreatorSelect = (user: { id: string; name: string } | null) => {
    setSelectedCreatorId(user?.id ?? null);
    setSelectedCreatorName(user?.name ?? null);
  };

  const handleLabelsSelect = (labelIds: string[]) => {
    setSelectedLabelIds(labelIds);
  };

  const handleChangeContentType = (value: string) => {
    setContentType(value);

    if (value === "attachment") {
      setSelectedLabelIds([]);
    }
  };

  const onDemandFilters = [
    { key: "creator", label: t("Created by"), icon: IconUser, available: true },
    {
      key: "labels",
      label: t("Labels"),
      icon: IconTag,
      available: contentType !== "attachment",
    },
  ];

  const isFilterVisible = (key: string) => {
    if (openedFilter === key) return true;
    if (key === "creator") return !!selectedCreatorId;
    if (key === "labels")
      return contentType !== "attachment" && selectedLabelIds.length > 0;
    return false;
  };

  const orderedVisibleFilters = visibleFilters.filter(isFilterVisible);
  const addableFilters = onDemandFilters.filter(
    (filter) => filter.available && !isFilterVisible(filter.key),
  );

  const revealFilter = (key: string) => {
    setVisibleFilters((prev) => [...prev.filter((k) => k !== key), key]);
    setOpenedFilter(key);
  };

  return (
    <ScrollArea
      scrollbars="x"
      scrollbarSize={5}
      classNames={{ content: classes.filtersContainer }}
    >
      {workspace?.settings?.ai?.search === true && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "32px",
            paddingLeft: "8px",
            paddingRight: "8px",
          }}
        >
          <Switch
            checked={isAiMode}
            onChange={(event) => onAskClick()}
            label={t("AI Answers")}
            size="sm"
            color="blue"
            labelPosition="left"
            styles={{
              root: {
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              },
              label: {
                whiteSpace: "nowrap",
                paddingRight: "8px",
                fontSize: "13px",
                fontWeight: 500,
              },
            }}
          />
        </div>
      )}

      <SpaceFilterMenu
        value={selectedSpaceId}
        onChange={handleSpaceSelect}
        currentSpaceId={spaceId}
        position="bottom-start"
        width={250}
        zIndex={getDefaultZIndex("max")}
      >
        <Button
          variant="subtle"
          color="gray"
          size="sm"
          rightSection={<IconChevronDown size={14} />}
          leftSection={<IconBuilding size={16} />}
          className={classes.filterButton}
          fw={500}
        >
          {selectedSpaceId
            ? `${t("Space")}: ${selectedSpaceData?.name || t("Unknown")}`
            : `${t("Space")}: ${t("All spaces")}`}
        </Button>
      </SpaceFilterMenu>

      <Menu
        shadow="md"
        width={220}
        position="bottom-start"
        zIndex={getDefaultZIndex("max")}
      >
        <Menu.Target>
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            rightSection={<IconChevronDown size={14} />}
            leftSection={<IconFileDescription size={16} />}
            className={classes.filterButton}
            fw={500}
          >
            {contentType
              ? `${t("Type")}: ${contentTypeOptions.find((opt) => opt.value === contentType)?.label || t(contentType === "page" ? "Pages" : "Attachments")}`
              : t("Type")}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {contentTypeOptions.map((option) => (
            <Menu.Item
              key={option.value}
              component={RadioMenuItem}
              aria-checked={contentType === option.value}
              onClick={() =>
                !option.disabled &&
                contentType !== option.value &&
                handleChangeContentType(option.value)
              }
              disabled={
                option.disabled || (isAiMode && option.value === "attachment")
              }
            >
              <Group flex="1" gap="xs">
                <div>
                  <Text size="sm">{option.label}</Text>
                  {option.disabled && (
                    <Badge size="xs" mt={4}>
                      {t("Enterprise")}
                    </Badge>
                  )}
                  {!option.disabled && isAiMode && option.value === "attachment" && (
                    <Text size="xs" mt={4}>
                      {t("AI Answers not available for attachments")}
                    </Text>
                  )}
                </div>
                {contentType === option.value && <IconCheck size={20} aria-hidden />}
              </Group>
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>

      {!isAiMode && (
        <Button
          variant={titleOnly ? "light" : "subtle"}
          color={titleOnly ? "blue" : "gray"}
          size="sm"
          radius="xl"
          leftSection={<IconLetterCase size={16} />}
          className={cx(
            classes.filterButton,
            titleOnly && classes.filterButtonActive,
          )}
          fw={500}
          aria-pressed={titleOnly}
          onClick={() => setTitleOnly(!titleOnly)}
        >
          {t("Title only")}
        </Button>
      )}

      {!isAiMode &&
        orderedVisibleFilters.map((filterKey) => {
        if (filterKey === "creator") {
          return (
            <CreatorFilterMenu
              key="creator"
              value={selectedCreatorId}
              onChange={handleCreatorSelect}
              position="bottom-start"
              width={250}
              zIndex={getDefaultZIndex("max")}
              opened={openedFilter === "creator"}
              onOpenChange={(opened) =>
                setOpenedFilter(opened ? "creator" : null)
              }
            >
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                rightSection={<IconChevronDown size={14} />}
                leftSection={<IconUser size={16} />}
                className={classes.filterButton}
                fw={500}
              >
                {selectedCreatorId
                  ? `${t("Created by")}: ${selectedCreatorName || t("Unknown")}`
                  : `${t("Created by")}: ${t("Anyone")}`}
              </Button>
            </CreatorFilterMenu>
          );
        }

        if (filterKey === "labels") {
          return (
            <LabelFilterMenu
              key="labels"
              value={selectedLabelIds}
              onChange={handleLabelsSelect}
              position="bottom-start"
              width={250}
              zIndex={getDefaultZIndex("max")}
              opened={openedFilter === "labels"}
              onOpenChange={(opened) =>
                setOpenedFilter(opened ? "labels" : null)
              }
            >
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                rightSection={<IconChevronDown size={14} />}
                leftSection={<IconTag size={16} />}
                className={classes.filterButton}
                fw={500}
              >
                {selectedLabelIds.length > 0
                  ? `${t("Labels")} (${selectedLabelIds.length})`
                  : t("Labels")}
              </Button>
            </LabelFilterMenu>
          );
        }

        return null;
      })}

      {!isAiMode && includeArchived && (
        <Button
          variant="light"
          color="blue"
          size="sm"
          radius="xl"
          leftSection={<IconArchive size={16} />}
          rightSection={<IconX size={14} />}
          className={cx(classes.filterButton, classes.filterButtonActive)}
          fw={500}
          aria-pressed
          onClick={() => {
            setIncludeArchived(false);
            filterMenuTargetRef.current?.focus();
          }}
        >
          {t("Include archived")}
        </Button>
      )}

      {!isAiMode && (
        <Menu
          shadow="md"
          width={240}
          position="bottom-end"
          zIndex={getDefaultZIndex("max")}
        >
          <Menu.Target>
            <Button
              ref={filterMenuTargetRef}
              variant="subtle"
              color="gray"
              size="sm"
              leftSection={<IconPlus size={16} />}
              className={classes.filterButton}
              style={{ marginLeft: "auto" }}
              fw={500}
            >
              {t("Filter")}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {addableFilters.map((filter) => (
              <Menu.Item
                key={filter.key}
                leftSection={<filter.icon size={16} />}
                onClick={() => revealFilter(filter.key)}
              >
                {filter.label}
              </Menu.Item>
            ))}
            {addableFilters.length > 0 && <Menu.Divider />}
            <Menu.Item
              component={CheckboxMenuItem}
              aria-checked={includeArchived}
              closeMenuOnClick={false}
              leftSection={<IconArchive size={16} />}
              rightSection={
                <Switch
                  checked={includeArchived}
                  readOnly
                  size="sm"
                  tabIndex={-1}
                  aria-hidden
                  style={{ pointerEvents: "none" }}
                />
              }
              onClick={() => setIncludeArchived(!includeArchived)}
            >
              {t("Include archived")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </ScrollArea>
  );
}
