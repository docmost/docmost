import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionIcon, Popover, Stack } from "@mantine/core";
import { IconDots, IconEyeOff, IconSettings } from "@tabler/icons-react";
import { useAtom } from "jotai";
import {
  propertyMenuCloseRequestAtomFamily,
  propertyMenuDirtyAtomFamily,
} from "@/ee/base/atoms/base-atoms";
import { IBaseProperty } from "@/ee/base/types/base.types";
import {
  MenuItem,
  PropertyMenuContent,
} from "@/ee/base/components/property/property-menu";

type KanbanColumnMenuProps = {
  property: IBaseProperty;
  pageId: string;
  onHide: () => void;
};

export function KanbanColumnMenu({ property, pageId, onHide }: KanbanColumnMenuProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [view, setView] = useState<"menu" | "property">("menu");
  const [dirty, setDirty] = useAtom(propertyMenuDirtyAtomFamily(pageId)) as unknown as [boolean, (val: boolean) => void];
  const [closeRequest, setCloseRequest] = useAtom(propertyMenuCloseRequestAtomFamily(pageId)) as unknown as [number, (val: number) => void];

  const handleClose = useCallback(() => {
    setOpened(false);
    setView("menu");
  }, []);

  const wasOpenedRef = useRef(opened);
  useEffect(() => {
    if (wasOpenedRef.current && !opened) setDirty(false);
    wasOpenedRef.current = opened;
  }, [opened, setDirty]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) return;
      if (dirty) {
        setCloseRequest(closeRequest + 1);
      } else {
        handleClose();
      }
    },
    [dirty, closeRequest, setCloseRequest, handleClose],
  );

  const toggle = useCallback(() => {
    if (opened) {
      handleOpenChange(false);
    } else if (!dirty) {
      setOpened(true);
    }
  }, [opened, dirty, handleOpenChange]);

  return (
    <Popover
      opened={opened}
      onChange={handleOpenChange}
      onClose={handleClose}
      position="bottom-end"
      shadow="md"
      width={260}
      trapFocus
      returnFocus
      withinPortal
      closeOnClickOutside
      closeOnEscape
    >
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          size="sm"
          color="gray"
          aria-label={t("Column options")}
          onClick={toggle}
        >
          <IconDots size={14} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown
        p={0}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {view === "menu" ? (
          <Stack gap={0} p={4}>
            <MenuItem
              icon={<IconSettings size={14} />}
              label={t("Edit property")}
              onClick={() => setView("property")}
            />
            <MenuItem
              icon={<IconEyeOff size={14} />}
              label={t("Hide group")}
              onClick={() => {
                handleClose();
                onHide();
              }}
            />
          </Stack>
        ) : (
          <PropertyMenuContent
            property={property}
            opened={opened}
            onClose={handleClose}
            onDirtyChange={setDirty}
            pageId={pageId}
            initialPanel={property.pendingType ? "main" : "options"}
          />
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
