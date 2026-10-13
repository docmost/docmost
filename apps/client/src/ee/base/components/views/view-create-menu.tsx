import { useState, useCallback, useEffect, useRef } from "react";
import { useAtom } from "jotai";
import { Menu, ActionIcon, Tooltip } from "@mantine/core";
import { IconPlus, IconTable, IconLayoutKanban, IconArrowLeft } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IBase } from "@/ee/base/types/base.types";
import { useCreateViewMutation } from "@/ee/base/queries/base-view-query";
import { activeViewIdAtomFamily } from "@/ee/base/atoms/base-atoms";
import { getDescriptor } from "@/ee/base/property-types/property-type.registry";

type Panel = "types" | "groupBy";

type ViewCreateMenuProps = {
  base: IBase;
  pageId: string;
};

export function ViewCreateMenu({ base, pageId }: ViewCreateMenuProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [panel, setPanel] = useState<Panel>("types");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const createViewMutation = useCreateViewMutation();
  const [, setActiveViewId] = useAtom(
    activeViewIdAtomFamily(pageId),
  ) as unknown as [string | null, (val: string | null) => void];

  const groupable = base.properties.filter(
    (p) => p.type === "select" || p.type === "status",
  );

  const close = useCallback(() => {
    setOpened(false);
    setPanel("types");
  }, []);

  const submitView = useCallback(
    (input: { name: string; type: "table" | "kanban"; config?: Record<string, unknown> }) => {
      createViewMutation.mutate(
        { pageId, ...input },
        { onSuccess: (created) => setActiveViewId(created.id) },
      );
      close();
    },
    [pageId, createViewMutation, setActiveViewId, close],
  );

  const handleCreateTable = useCallback(() => {
    submitView({ name: t("Table"), type: "table" });
  }, [submitView, t]);

  const handleBoardClick = useCallback(() => {
    if (groupable.length <= 1) {
      const config =
        groupable.length === 1
          ? { groupByPropertyId: groupable[0].id }
          : undefined;
      submitView({ name: t("Kanban"), type: "kanban", config });
    } else {
      setPanel("groupBy");
    }
  }, [groupable, submitView, t]);

  const handleGroupByPick = useCallback(
    (propertyId: string) => {
      submitView({
        name: t("Kanban"),
        type: "kanban",
        config: { groupByPropertyId: propertyId },
      });
    },
    [submitView, t],
  );

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      dropdownRef.current
        ?.querySelector<HTMLElement>("[data-menu-item]:not([data-disabled])")
        ?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [panel]);

  return (
    <Menu
      opened={opened}
      onChange={(o) => {
        setOpened(o);
        if (!o) setPanel("types");
      }}
      position="bottom-start"
      shadow="md"
      width={200}
      withinPortal
      closeOnItemClick={false}
    >
      <Menu.Target>
        <Tooltip label={t("Add view")}>
          <ActionIcon variant="subtle" size="sm" color="gray" aria-label={t("Add view")}>
            <IconPlus size={14} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown ref={dropdownRef}>
        {panel === "types" && (
          <>
            <Menu.Item leftSection={<IconTable size={14} />} onClick={handleCreateTable}>
              {t("Table")}
            </Menu.Item>
            <Menu.Item leftSection={<IconLayoutKanban size={14} />} onClick={handleBoardClick}>
              {t("Kanban")}
            </Menu.Item>
          </>
        )}

        {panel === "groupBy" && (
          <>
            <Menu.Item leftSection={<IconArrowLeft size={14} />} onClick={() => setPanel("types")}>
              {t("Group by")}
            </Menu.Item>
            <Menu.Divider />
            {groupable.map((p) => {
              const Icon = getDescriptor(p.type)?.icon;
              return (
                <Menu.Item
                  key={p.id}
                  leftSection={Icon ? <Icon size={14} /> : undefined}
                  onClick={() => handleGroupByPick(p.id)}
                >
                  {p.name}
                </Menu.Item>
              );
            })}
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
