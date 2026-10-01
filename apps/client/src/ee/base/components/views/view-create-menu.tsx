import { useState, useCallback, useEffect, useRef } from "react";
import { useAtom } from "jotai";
import { Menu, ActionIcon, Tooltip } from "@mantine/core";
import { IconPlus, IconArrowLeft } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { BaseViewType, IBase, ViewConfig } from "@/ee/base/types/base.types";
import { useCreateViewMutation } from "@/ee/base/queries/base-view-query";
import { activeViewIdAtomFamily } from "@/ee/base/atoms/base-atoms";
import { getDescriptor } from "@/ee/base/property-types/property-type.registry";
import { VIEW_TYPE_ICONS } from "@/ee/base/components/views/view-type-icon";
import {
  MAX_FORM_FIELDS,
  isFormFieldProperty,
} from "@/ee/base/components/form/form-definition";
import { usePageQuery } from "@/features/page/queries/page-query";

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
  const { data: page } = usePageQuery({ pageId });
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
    (input: { name: string; type: BaseViewType; config?: ViewConfig }) => {
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

  const handleCreateForm = useCallback(() => {
    const title = page?.title?.trim().slice(0, 300);
    submitView({
      name: t("Form"),
      type: "form",
      config: {
        form: {
          ...(title ? { title } : {}),
          fields: base.properties
            .filter(isFormFieldProperty)
            .slice(0, MAX_FORM_FIELDS)
            .map((property) => ({ propertyId: property.id })),
        },
      },
    });
  }, [base.properties, page?.title, submitView, t]);

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
            <Menu.Item leftSection={<VIEW_TYPE_ICONS.table size={14} />} onClick={handleCreateTable}>
              {t("Table")}
            </Menu.Item>
            <Menu.Item leftSection={<VIEW_TYPE_ICONS.kanban size={14} />} onClick={handleBoardClick}>
              {t("Kanban")}
            </Menu.Item>
            <Menu.Item leftSection={<VIEW_TYPE_ICONS.form size={14} />} onClick={handleCreateForm}>
              {t("Form")}
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
