import {
  Anchor,
  Button,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useDebouncedValue, useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconSearch } from "@tabler/icons-react";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  M365Drive,
  M365Item,
  M365Site,
  MicrosoftInsertMode,
} from "@/features/microsoft/types/microsoft.types";
import {
  useM365Children,
  useM365Drives,
  useM365Search,
  useM365SharedWithMe,
  useM365Sites,
} from "@/features/microsoft/queries/microsoft-query";
import { listMicrosoftChildren } from "@/features/microsoft/services/microsoft-service";
import { M365RequestState } from "@/features/microsoft/hooks/use-m365-request";
import { getApiErrorMessage } from "@/lib/api-error";
import { PickerItemList, itemKey } from "./picker-item-list";
import { PickerBreadcrumbs, PickerCrumb } from "./picker-breadcrumbs";
import { PickerNeedsConnection } from "./picker-needs-connection";
import classes from "./picker.module.css";

type PickerTab = "search" | "sites" | "onedrive" | "shared";

type Browse = {
  driveId: string;
  crumbs: { itemId: string | null; name: string }[];
};

export type MicrosoftPickerModalProps = {
  opened: boolean;
  onClose: () => void;
  onSelect: (items: M365Item[], mode: MicrosoftInsertMode) => void;
  multiple?: boolean;
};

function failedToLoad(state: M365RequestState<unknown>["state"]): boolean {
  return state !== "loaded" && state !== "loading";
}

function needsConnectionOf(...states: M365RequestState<unknown>[]) {
  for (const state of states) {
    if (state.state === "needsConnection") return state.needsConnection;
  }
  return null;
}

function oneDriveRoot(name: string): Browse {
  return { driveId: "me", crumbs: [{ itemId: null, name }] };
}

export function MicrosoftPickerModal({
  opened,
  onClose,
  onSelect,
  multiple = true,
}: MicrosoftPickerModalProps) {
  const { t } = useTranslation();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const [tab, setTab] = useState<PickerTab>("onedrive");
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query.trim(), 300);
  const [site, setSite] = useState<M365Site | null>(null);
  const [browse, setBrowse] = useState<Browse | null>(() => oneDriveRoot(t("My OneDrive")));
  const [extraItems, setExtraItems] = useState<M365Item[]>([]);
  const [appendedToken, setAppendedToken] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Map<string, M365Item>>(new Map());
  const [mode, setMode] = useState<MicrosoftInsertMode>("embed");

  const selectTab = (value: string | null) => {
    if (!value) return;
    const next = value as PickerTab;
    setTab(next);
    setQuery("");
    setSite(null);
    setBrowse(next === "onedrive" ? oneDriveRoot(t("My OneDrive")) : null);
  };

  useEffect(() => {
    if (!opened) return;
    selectTab("onedrive");
    setSelected(new Map());
    setMode("embed");
  }, [opened]);

  useEffect(() => {
    setExtraItems([]);
    setAppendedToken(undefined);
  }, [opened, browse?.driveId, browse?.crumbs.length, tab]);

  const currentFolder = browse ? browse.crumbs[browse.crumbs.length - 1] : null;
  const browsing = opened && Boolean(browse);

  const shared = useM365SharedWithMe(opened && tab === "shared");
  const search = useM365Search(debouncedQuery, opened && tab === "search");
  const sites = useM365Sites(debouncedQuery, opened && tab === "sites" && !site);
  const drives = useM365Drives(site?.siteId ?? null, opened && tab === "sites" && Boolean(site) && !browse);
  const children = useM365Children(
    browse?.driveId ?? null,
    currentFolder?.itemId ?? null,
    undefined,
    browsing,
  );

  const needsConnection = needsConnectionOf(shared, search, sites, drives, children);

  const openFolder = (item: M365Item) => {
    setBrowse((current) => ({
      driveId: item.driveId,
      crumbs: [...(current?.driveId === item.driveId ? current.crumbs : [{ itemId: null, name: t("Files") }]), { itemId: item.itemId, name: item.name }],
    }));
  };

  const openDrive = (drive: M365Drive) => {
    setBrowse({ driveId: drive.driveId, crumbs: [{ itemId: null, name: drive.name }] });
  };

  const toggle = (item: M365Item) => {
    setSelected((current) => {
      const next = new Map(multiple ? current : []);
      const key = itemKey(item);
      if (next.has(key)) next.delete(key);
      else next.set(key, item);
      return next;
    });
  };

  const firstPageToken = children.state === "loaded" ? children.data.nextPageToken : undefined;
  const effectiveToken = extraItems.length ? appendedToken : firstPageToken;

  const loadMore = async () => {
    if (!browse || !effectiveToken) return;
    setLoadingMore(true);
    try {
      const page = await listMicrosoftChildren({
        driveId: browse.driveId,
        itemId: currentFolder?.itemId ?? undefined,
        pageToken: effectiveToken,
      });
      setExtraItems((current) => [...current, ...page.items]);
      setAppendedToken(page.nextPageToken);
    } catch (error) {
      notifications.show({ message: getApiErrorMessage(error, t("Failed to load more files")), color: "red" });
    } finally {
      setLoadingMore(false);
    }
  };

  const crumbs = useMemo<PickerCrumb[]>(() => {
    const list: PickerCrumb[] = [];
    if (tab === "sites") {
      list.push({ id: "sites", name: t("Sites") });
      if (site) list.push({ id: `site:${site.siteId}`, name: site.name });
    }
    if (browse) {
      browse.crumbs.forEach((crumb, index) => list.push({ id: `crumb:${index}`, name: crumb.name }));
    }
    return list;
  }, [tab, site, browse, t]);

  const navigateCrumb = (index: number) => {
    const crumb = crumbs[index];
    if (crumb.id === "sites") {
      setSite(null);
      setBrowse(null);
      return;
    }
    if (crumb.id.startsWith("site:")) {
      setBrowse(null);
      return;
    }
    const crumbIndex = Number(crumb.id.slice("crumb:".length));
    setBrowse((current) => (current ? { ...current, crumbs: current.crumbs.slice(0, crumbIndex + 1) } : current));
  };

  const listState: M365RequestState<unknown> =
    browse ? children : tab === "shared" ? shared : tab === "search" ? search : sites;

  const items: M365Item[] = browse
    ? children.state === "loaded"
      ? [...children.data.items, ...extraItems]
      : []
    : tab === "shared" && shared.state === "loaded"
      ? shared.data
      : tab === "search" && search.state === "loaded"
        ? search.data
        : [];

  const selectedKeys = useMemo(() => new Set(selected.keys()), [selected]);

  const searchIdle = tab === "search" && !browse && debouncedQuery.length < 2;

  const emptyLabel = browse
    ? t("This folder is empty")
    : tab === "search"
      ? debouncedQuery.length < 2
        ? t("Type at least two characters to search")
        : t("No files found")
      : t("No files found");

  const showSearchBox = tab === "search" || (tab === "sites" && !site);

  const body = needsConnection ? (
    <PickerNeedsConnection needsConnection={needsConnection} />
  ) : (
    <Stack gap="sm">
      {showSearchBox && (
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={tab === "sites" ? t("Search sites") : t("Search files")}
          leftSection={<IconSearch size={16} />}
          data-autofocus
        />
      )}
      <PickerBreadcrumbs crumbs={crumbs} onNavigate={navigateCrumb} />
      {tab === "sites" && !site ? (
        sites.state === "loading" ? (
          <div className={clsx(classes.list, classes.empty)}>
            <Loader size="sm" />
          </div>
        ) : (
          <div className={classes.list}>
            {failedToLoad(sites.state) && (
              <Text size="sm" c="dimmed" className={classes.empty}>
                {t("Could not load sites")}
              </Text>
            )}
            {sites.state === "loaded" && sites.data.length === 0 && (
              <Text size="sm" c="dimmed" className={classes.empty}>
                {t("No sites found")}
              </Text>
            )}
            {sites.state === "loaded" &&
              sites.data.map((entry) => (
                <Anchor key={entry.siteId} component="button" type="button" className={classes.row} onClick={() => setSite(entry)}>
                  <div className={classes.rowMain}>
                    <Text size="sm" fw={500} truncate>
                      {entry.name}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {entry.webUrl}
                    </Text>
                  </div>
                </Anchor>
              ))}
          </div>
        )
      ) : tab === "sites" && site && !browse ? (
        drives.state === "loading" ? (
          <div className={clsx(classes.list, classes.empty)}>
            <Loader size="sm" />
          </div>
        ) : (
          <div className={classes.list}>
            {failedToLoad(drives.state) && (
              <Text size="sm" c="dimmed" className={classes.empty}>
                {t("Could not load document libraries")}
              </Text>
            )}
            {drives.state === "loaded" && drives.data.length === 0 && (
              <Text size="sm" c="dimmed" className={classes.empty}>
                {t("No document libraries found")}
              </Text>
            )}
            {drives.state === "loaded" &&
              drives.data.map((drive) => (
                <Anchor key={drive.driveId} component="button" type="button" className={classes.row} onClick={() => openDrive(drive)}>
                  <div className={classes.rowMain}>
                    <Text size="sm" fw={500} truncate>
                      {drive.name}
                    </Text>
                  </div>
                </Anchor>
              ))}
          </div>
        )
      ) : (
        <PickerItemList
          items={searchIdle ? [] : items}
          loading={!searchIdle && listState.state === "loading"}
          selectedKeys={selectedKeys}
          emptyLabel={
            !searchIdle && failedToLoad(listState.state)
              ? t("Could not load files")
              : emptyLabel
          }
          onToggle={toggle}
          onOpenFolder={openFolder}
        />
      )}
      {browse && effectiveToken && (
        <Button variant="subtle" size="xs" loading={loadingMore} onClick={loadMore}>
          {t("Load more")}
        </Button>
      )}
    </Stack>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Choose a SharePoint file")}
      size="lg"
      fullScreen={isMobile}
      keepMounted={false}
    >
      <Tabs value={tab} onChange={selectTab} keepMounted={false}>
        <Tabs.List style={{ flexWrap: "nowrap", overflowX: "auto" }}>
          <Tabs.Tab value="onedrive">{t("My OneDrive")}</Tabs.Tab>
          <Tabs.Tab value="search">{t("Search")}</Tabs.Tab>
          <Tabs.Tab value="sites">{t("Sites")}</Tabs.Tab>
          <Tabs.Tab value="shared">{t("Shared with me")}</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <div style={{ marginTop: "var(--mantine-spacing-sm)" }}>{body}</div>
      <Group justify="space-between" mt="md">
        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(value) => setMode(value as MicrosoftInsertMode)}
          data={[
            { value: "embed", label: t("Embed") },
            { value: "mention", label: t("Mention") },
          ]}
        />
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            {t("{{count}} selected", { count: selected.size })}
          </Text>
          <Button variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button
            color="dark"
            disabled={selected.size === 0}
            onClick={() => onSelect(Array.from(selected.values()), mode)}
          >
            {t("Insert")}
          </Button>
        </Group>
      </Group>
    </Modal>
  );
}
