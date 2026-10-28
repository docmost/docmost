import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Button, Center } from "@mantine/core";
import { useIntersection } from "@mantine/hooks";
import clsx from "clsx";
import { useState, type ComponentProps, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  sanitizeMicrosoftFolderUrl,
  type MicrosoftFolderAttributes,
} from "@docmost/editor-ext";
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
  const [seen, setSeen] = useState(false);
  const [path, setPath] = useState<FolderPathEntry[]>([]);
  const [sort, setSort] = useState<FolderSort>(DEFAULT_FOLDER_SORT);

  if (entry?.isIntersecting && !seen) setSeen(true);

  const current = path.length ? path[path.length - 1] : { driveId, itemId };
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

  const item = {
    driveId,
    itemId,
    webUrl: sanitizeMicrosoftFolderUrl(webUrl),
    name,
  };
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
              name: folder.name,
            },
          ])
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

  return <div ref={ref}>{body}</div>;
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
