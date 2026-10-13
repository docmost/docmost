import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SlashMenuGroupedItemsType,
  SlashMenuItemType,
} from "@/features/editor/components/slash-menu/types";
import {
  ActionIcon,
  Badge,
  Group,
  Paper,
  ScrollArea,
  Text,
  Tooltip,
  UnstyledButton,
  VisuallyHidden,
} from "@mantine/core";
import classes from "./slash-menu.module.css";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";

const CommandList = ({
  items,
  command,
  editor,
  range,
}: {
  items: SlashMenuGroupedItemsType;
  command: any;
  editor: any;
  range: any;
}) => {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [countAnnouncement, setCountAnnouncement] = useState("");
  const [selectionAnnouncement, setSelectionAnnouncement] = useState("");

  const hasBases = useHasFeature(Feature.BASES);
  const upgradeLabel = useUpgradeLabel();
  // Without the bases entitlement the item stays visible but inert; an
  // expired license the client can't detect falls through to a handled
  // create failure.
  const isItemDisabled = (item: SlashMenuItemType) =>
    !hasBases && item.requiresBases === true;

  const flatItems = useMemo(() => {
    return Object.values(items).flat();
  }, [items]);

  const selectItem = useCallback(
    (index: number) => {
      const item = flatItems[index];
      if (item && !isItemDisabled(item)) {
        command(item);
      }
    },
    [command, flatItems, hasBases],
  );

  useEffect(() => {
    const navigationKeys = ["ArrowUp", "ArrowDown", "Enter"];
    const onKeyDown = (e: KeyboardEvent) => {
      if (navigationKeys.includes(e.key)) {
        e.preventDefault();

        if (e.key === "ArrowUp") {
          setSelectedIndex(
            (selectedIndex + flatItems.length - 1) % flatItems.length,
          );
          return true;
        }

        if (e.key === "ArrowDown") {
          setSelectedIndex((selectedIndex + 1) % flatItems.length);
          return true;
        }

        if (e.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [flatItems, selectedIndex, setSelectedIndex, selectItem]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [flatItems]);

  useEffect(() => {
    if (flatItems.length === 0) {
      setCountAnnouncement("");
      return;
    }
    setCountAnnouncement(
      t("{{count}} command available", { count: flatItems.length }),
    );
  }, [flatItems.length, t]);

  useEffect(() => {
    const item = flatItems[selectedIndex];
    if (!item) {
      setSelectionAnnouncement("");
      return;
    }
    setSelectionAnnouncement(`${t(item.title)}, ${t(item.description)}`);
  }, [selectedIndex, flatItems, t]);

  useEffect(() => {
    viewportRef.current
      ?.querySelector(`[data-item-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return flatItems.length > 0 ? (
    <Paper
      id="slash-command"
      shadow="md"
      p="xs"
      withBorder
      role="listbox"
      aria-label={t("Slash commands")}
      aria-activedescendant={`slash-command-option-${selectedIndex}`}
    >
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {countAnnouncement}
      </VisuallyHidden>
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {selectionAnnouncement}
      </VisuallyHidden>
      <ScrollArea
        viewportRef={viewportRef}
        h={350}
        w={270}
        scrollbarSize={8}
        overscrollBehavior="contain"
      >
        {(() => {
          let flatIndex = -1;
          return Object.entries(items).map(([category, categoryItems]) => (
          <div key={category} role="group" aria-label={category}>
            <Text c="dimmed" mb={4} fw={500} tt="capitalize">
              {category}
            </Text>
            {categoryItems.map((item: SlashMenuItemType) => {
              flatIndex += 1;
              const itemIndex = flatIndex;
              const disabled = isItemDisabled(item);
              return (
              <Tooltip
                key={itemIndex}
                label={upgradeLabel}
                disabled={!disabled}
                position="right"
              >
              <UnstyledButton
                data-item-index={itemIndex}
                id={`slash-command-option-${itemIndex}`}
                role="option"
                aria-selected={itemIndex === selectedIndex}
                aria-disabled={disabled}
                onClick={() => selectItem(itemIndex)}
                className={clsx(classes.menuBtn, {
                  [classes.selectedItem]: itemIndex === selectedIndex,
                  [classes.gatedItem]: disabled,
                })}
              >
                <Group wrap="nowrap">
                  <ActionIcon variant="default" component="div" aria-hidden="true">
                    <item.icon size={18} />
                  </ActionIcon>

                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>
                      {t(item.title)}
                    </Text>

                    <Text c="dimmed" size="xs">
                      {t(item.description)}
                    </Text>
                  </div>

                  {disabled && (
                    <Badge size="xs" variant="light" color="gray">
                      {t("Upgrade")}
                    </Badge>
                  )}
                </Group>
              </UnstyledButton>
              </Tooltip>
              );
            })}
          </div>
          ));
        })()}
      </ScrollArea>
    </Paper>
  ) : null;
};

export default CommandList;
