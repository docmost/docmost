import { useEffect, useId, useMemo, useState } from "react";
import { ActionIcon, MantineThemeProvider, Menu, Portal } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import {
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconPlus,
  IconReportAnalytics,
} from "@tabler/icons-react";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { announce } from "@atlaskit/pragmatic-drag-and-drop-live-region";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { useTranslation } from "react-i18next";
import { atom, useAtomValue, useSetAtom } from "jotai";
import clsx from "clsx";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { PagePropertyReport } from "./report/page-property-report";
import { PagePropertyDialog } from "./page-property-dialog";
import { PagePropertyRow } from "./page-property-row";
import { hasPagePropertyValue, PagePropertyValue } from "./page-property-value";
import { usePageProperties } from "./page-property-query";
import type { PageProperty } from "./page-property.types";
import classes from "./page-properties.module.css";

type PanelProps = {
  pageId: string;
  spaceId: string;
  editable: boolean;
  inBase?: boolean;
};

type AddPagePropertyAction = { pageId: string; open: () => void };
const addPagePropertyActionAtom = atom(null as AddPagePropertyAction | null);

export function AddPagePropertyMenuItem({ pageId }: { pageId: string }) {
  const { t } = useTranslation();
  const action = useAtomValue(addPagePropertyActionAtom);
  if (!action || action.pageId !== pageId) return null;

  return (
    <Menu.Item
      className="print-hide"
      leftSection={<IconPlus size={16} />}
      onClick={action.open}
    >
      {t("Add property")}
    </Menu.Item>
  );
}

export function PagePropertiesPanel(props: PanelProps) {
  const user = useAtomValue(userAtom);
  const enabled = useHasFeature(Feature.PAGE_PROPERTIES);
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
  const portalTheme = useMemo(
    () => ({
      components: {
        Portal: { defaultProps: () => ({ target: portalTarget }) },
      },
    }),
    [portalTarget],
  );
  if (!enabled || !user?.id) return null;
  return (
    <>
      {/* Menus, dialogs and their nested pickers render outside the panel. */}
      <Portal>
        <div className="print-hide" ref={setPortalTarget} />
      </Portal>
      {portalTarget && (
        <MantineThemeProvider theme={portalTheme}>
          <Properties
            key={`${user.id}/${props.pageId}`}
            {...props}
            userId={user.id}
          />
        </MantineThemeProvider>
      )}
    </>
  );
}

function Properties({
  pageId,
  spaceId,
  editable,
  inBase,
  userId,
}: PanelProps & { userId: string }) {
  const { t } = useTranslation();
  const { query, properties, mutation } = usePageProperties(pageId, userId);
  const [collapsed, setCollapsed] = useLocalStorage({
    key: `page-properties-collapsed:${userId}`,
    defaultValue: false,
    getInitialValueInEffect: false,
  });
  const [dialog, setDialog] = useState<PageProperty | "create" | null>(null);
  const [reportOpened, setReportOpened] = useState(false);
  const setAddPropertyAction = useSetAtom(addPagePropertyActionAtom);
  const loaded = !query.isError && query.isFetchedAfterMount && !!query.data;
  useEffect(() => {
    if (!editable || !loaded) return;
    const action = { pageId, open: () => setDialog("create") };
    setAddPropertyAction(action);
    return () =>
      setAddPropertyAction((current) => (current === action ? null : current));
  }, [editable, loaded, pageId, setAddPropertyAction]);

  const rowsId = useId();
  const className = clsx(
    "print-hide",
    classes.panel,
    inBase && classes.basePanel,
  );
  if (!loaded) {
    return query.isError ? (
      <div className={className}>
        <button
          className={classes.textButton}
          onClick={() => query.refetch()}
          type="button"
        >
          {t("Could not load properties. Try again")}
        </button>
      </div>
    ) : null;
  }

  const move = (sourceId: string, targetId: string, edge: Edge) => {
    if (sourceId === targetId) return;
    const sourceIndex = properties.findIndex(({ id }) => id === sourceId);
    const rest = properties.filter(({ id }) => id !== sourceId);
    const targetIndex = rest.findIndex(({ id }) => id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const index = targetIndex + (edge === "bottom" ? 1 : 0);
    if (index === sourceIndex) return;
    const lower = rest[index - 1]?.position ?? null;
    const upper = rest[index]?.position ?? null;
    const position = generateJitteredKeyBetween(
      lower,
      upper === lower ? null : upper,
    );
    mutation.mutate(
      { action: "reorder", propertyId: sourceId, position },
      {
        onSuccess: () =>
          announce(
            t("Moved {{name}} to position {{position}}", {
              name: properties[sourceIndex].name,
              position: index + 1,
            }),
          ),
      },
    );
  };

  const valued = collapsed ? properties.filter(hasPagePropertyValue) : [];
  const Chevron = collapsed ? IconChevronRight : IconChevronDown;
  return (
    <>
      {properties.length > 0 && (
        <section className={className} aria-label={t("Properties")}>
          <div className={classes.content}>
            <div className={classes.heading}>
              <button
                type="button"
                aria-expanded={!collapsed}
                aria-controls={rowsId}
                className={classes.disclosure}
                onClick={() => setCollapsed(!collapsed)}
              >
                <Chevron size={14} aria-hidden />
                <span>{t("Properties")}</span>
                <span className={classes.count}>{properties.length}</span>
              </button>
              {valued.length > 0 && (
                <div className={classes.preview}>
                  {valued.slice(0, 3).map((p) => (
                    <span
                      className={classes.previewItem}
                      key={p.id}
                      title={p.name}
                    >
                      <PagePropertyValue property={p} compact />
                    </span>
                  ))}
                  {valued.length > 3 && (
                    <span className={classes.more}>
                      {t("+{{count}} more", { count: valued.length - 3 })}
                    </span>
                  )}
                </div>
              )}
              <Menu withinPortal position="bottom-end" shadow="md" width={180}>
                <Menu.Target>
                  <ActionIcon
                    className={classes.actions}
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label={t("Property actions")}
                  >
                    <IconDots size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  {editable && (
                    <Menu.Item
                      leftSection={<IconPlus size={15} />}
                      onClick={() => setDialog("create")}
                    >
                      {t("Add property")}
                    </Menu.Item>
                  )}
                  <Menu.Item
                    leftSection={<IconReportAnalytics size={15} />}
                    onClick={() => setReportOpened(true)}
                  >
                    {t("Property report")}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </div>
            <div id={rowsId} hidden={collapsed}>
              {!collapsed && (
                <dl className={classes.rows}>
                  {properties.map((property, index) => (
                    <PagePropertyRow
                      key={property.id}
                      property={property}
                      editable={editable}
                      first={index === 0}
                      last={index === properties.length - 1}
                      onEdit={() => setDialog(property)}
                      onChange={(value) =>
                        mutation.mutate({
                          action: "values/update",
                          values: { [property.id]: value },
                        })
                      }
                      onSaveChoices={(typeOptions, expectedSchemaVersion) =>
                        mutation.mutateAsync({
                          action: "update",
                          propertyId: property.id,
                          typeOptions,
                          expectedSchemaVersion,
                        }) as Promise<PageProperty>
                      }
                      onReorder={move}
                      onMove={(offset) => {
                        const target = properties[index + offset];
                        if (target)
                          move(
                            property.id,
                            target.id,
                            offset === -1 ? "top" : "bottom",
                          );
                      }}
                    />
                  ))}
                </dl>
              )}
            </div>
          </div>
        </section>
      )}
      {editable && dialog && (
        <PagePropertyDialog
          pageId={pageId}
          properties={properties}
          property={dialog === "create" ? undefined : dialog}
          onClose={() => setDialog(null)}
          saving={
            mutation.isPending &&
            ["create", "update", "delete"].includes(mutation.variables?.action)
          }
          onSave={(change, onSuccess) => mutation.mutate(change, { onSuccess })}
        />
      )}
      {reportOpened && properties.length > 0 && (
        <PagePropertyReport
          pageId={pageId}
          spaceId={spaceId}
          properties={properties}
          opened={reportOpened}
          onClose={() => setReportOpened(false)}
        />
      )}
    </>
  );
}
