import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Button, Center } from "@mantine/core";
import { useIntersection, useMergedRef } from "@mantine/hooks";
import clsx from "clsx";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useAtomValue, useSetAtom, type PrimitiveAtom } from "jotai";
import {
  sanitizeMicrosoftFolderUrl,
  type MicrosoftFileItem,
  type MicrosoftFolderAttributes,
} from "@docmost/editor-ext";
import {
  microsoftFullscreenAtom,
  microsoftFullscreenHostsAtom,
} from "@/features/microsoft/atoms/microsoft-atoms";
import { useM365Folder } from "@/features/microsoft/queries/microsoft-query";
import { FileStateCard } from "./file-state-card";
import { FolderTable } from "./folder-table";
import { FolderTableSkeleton } from "./folder-table-skeleton";
import { DEFAULT_FOLDER_SORT } from "./folder-table.constants";
import type { FolderPathEntry, FolderSort } from "./folder-table.types";
import { buildFolderCrumbs } from "./folder-table.utils";
import classes from "./microsoft-folder.module.css";

type StateCardProps = Pick<
  ComponentProps<typeof FileStateCard>,
  "needsConnection" | "onRetry"
>;

function FolderEmbed({
  driveId,
  itemId,
  webUrl,
  name,
}: MicrosoftFolderAttributes) {
  const { t } = useTranslation();
  const { ref, entry } = useIntersection<HTMLDivElement>({
    rootMargin: "200px",
    threshold: 0,
  });
  const contentRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRef(ref, contentRef);
  const [seen, setSeen] = useState(false);
  const [path, setPath] = useState<FolderPathEntry[]>([]);
  const [sort, setSort] = useState<FolderSort>(DEFAULT_FOLDER_SORT);
  const shownPath = useRef(path);
  const setFullscreen = useSetAtom(
    microsoftFullscreenAtom as PrimitiveAtom<MicrosoftFileItem | null>,
  );
  const hosts = useAtomValue(microsoftFullscreenHostsAtom);

  if (entry?.isIntersecting && !seen) setSeen(true);

  useEffect(() => {
    if (shownPath.current === path) return;
    shownPath.current = path;
    contentRef.current?.focus({ preventScroll: true });
  }, [path]);

  const current: FolderPathEntry = path.length
    ? path[path.length - 1]
    : { driveId, itemId, webUrl, name };
  const rootView = useM365Folder(driveId, itemId, seen);
  const currentView = useM365Folder(current.driveId, current.itemId, seen);

  const rootLoaded = rootView.state === "loaded";
  const rootName = rootLoaded ? rootView.data.folder.name || name : name;
  const crumbs = buildFolderCrumbs(
    rootLoaded ? rootView.data.trail : [],
    rootName,
    path,
  );
  const parent = path.length
    ? {
        depth: path.length - 1,
        name: path.length === 1 ? rootName : path[path.length - 2].name,
      }
    : null;

  const item = { ...current, webUrl: sanitizeMicrosoftFolderUrl(current.webUrl) };
  const goBack = parent && (
    <Center pb="md">
      <Button
        variant="subtle"
        size="xs"
        onClick={() => setPath((entries) => entries.slice(0, parent.depth))}
      >
        {t("Go back to {{name}}", { name: parent.name })}
      </Button>
    </Center>
  );
  const stateCard = (
    description: string,
    extra: StateCardProps = {},
    footer: ReactNode = null,
  ) => (
    <div className={classes.frame}>
      <FileStateCard
        item={item}
        kind="folder"
        description={description}
        {...extra}
      />
      {footer}
    </div>
  );

  let body: ReactNode;
  if (!driveId || !itemId) {
    body = stateCard(t("Could not load this folder"));
  } else if (currentView.state === "loaded") {
    body = (
      <FolderTable
        view={currentView.data}
        crumbs={crumbs}
        sort={sort}
        parent={parent}
        onSortChange={setSort}
        onNavigate={(depth) => setPath((entries) => entries.slice(0, depth))}
        onOpenFolder={(folder) =>
          setPath((entries) => [
            ...entries,
            {
              driveId: folder.driveId,
              itemId: folder.itemId,
              webUrl: folder.webUrl,
              name: folder.name,
            },
          ])
        }
        // Without a mounted preview modal, file names stay plain SharePoint links
        onOpenFile={
          hosts > 0
            ? (file) =>
                setFullscreen({
                  driveId: file.driveId,
                  itemId: file.itemId,
                  webUrl: sanitizeMicrosoftFolderUrl(file.webUrl),
                  name: file.name,
                })
            : undefined
        }
      />
    );
  } else if (currentView.state === "loading") {
    body = <FolderTableSkeleton />;
  } else if (currentView.state === "anonymous") {
    body = stateCard(t("Sign in to Microsoft 365 to see this folder"));
  } else if (currentView.state === "needsConnection") {
    body = stateCard(
      t("Connect your Microsoft 365 account to see this folder"),
      { needsConnection: currentView.needsConnection },
      goBack,
    );
  } else if (currentView.state === "forbidden") {
    body = stateCard(
      t("You do not have access to this folder in SharePoint"),
      {},
      goBack,
    );
  } else if (currentView.state === "notFound") {
    body = stateCard(t("This folder was moved or deleted"), {}, goBack);
  } else {
    body = stateCard(
      t("Could not load this folder"),
      { onRetry: currentView.refetch },
      goBack,
    );
  }

  return (
    <div ref={mergedRef} tabIndex={-1}>
      {body}
    </div>
  );
}

export default function MicrosoftFolderView({ node, selected }: NodeViewProps) {
  const { driveId, itemId, webUrl, name } =
    node.attrs as MicrosoftFolderAttributes;

  return (
    <NodeViewWrapper
      data-drag-handle
      className={clsx(
        classes.folderNodeView,
        selected && "ProseMirror-selectednode",
      )}
    >
      <FolderEmbed
        key={`${driveId}:${itemId}`}
        driveId={driveId}
        itemId={itemId}
        webUrl={webUrl}
        name={name}
      />
    </NodeViewWrapper>
  );
}
