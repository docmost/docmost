import { useEffect, useMemo, useState } from "react";
import {
  Anchor,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import {
  IconFileText,
  IconFolder,
  IconPin,
} from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { useCreatePageMutation, useGetSidebarPagesQuery } from "@/features/page/queries/page-query";
import { IPage } from "@/features/page/types/page.types";
import { buildPageUrl } from "@/features/page/page.utils";
import { useAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { TitleEditor } from "@/features/editor/title-editor";
import classes from "./folder-view.module.css";

interface FolderViewProps {
  folderPage: IPage;
  readOnly: boolean;
  spaceSlug?: string;
}

export default function FolderView({
  folderPage,
  readOnly,
  spaceSlug,
}: FolderViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user] = useAtom(userAtom);
  const fullPageWidth = user.settings?.preferences?.fullPageWidth;
  const currentSpaceSlug = spaceSlug ?? folderPage?.space?.slug ?? "";
  const [creatingNodeType, setCreatingNodeType] = useState<"file" | "folder" | null>(null);
  const createPageMutation = useCreatePageMutation();
  const {
    data,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isLoading,
  } = useGetSidebarPagesQuery({
    spaceId: folderPage.spaceId,
    pageId: folderPage.id,
  });

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const children = useMemo(
    () => data?.pages.flatMap((page) => page.items ?? []) ?? [],
    [data],
  );

  async function handleCreateChild(nodeType: "file" | "folder") {
    if (readOnly || creatingNodeType) {
      return;
    }

    setCreatingNodeType(nodeType);

    try {
      const createdPage = await createPageMutation.mutateAsync({
        spaceId: folderPage.spaceId,
        parentPageId: folderPage.id,
        nodeType,
      });

      navigate(
        buildPageUrl(currentSpaceSlug, createdPage.slugId, createdPage.title),
      );
    } catch (err: any) {
      notifications.show({
        color: "red",
        message: err?.response?.data?.message || t("Failed to create page"),
      });
    } finally {
      setCreatingNodeType(null);
    }
  }

  return (
    <Container
      fluid={fullPageWidth}
      size={!fullPageWidth && 920}
      className={classes.container}
    >
      <TitleEditor
        pageId={folderPage.id}
        slugId={folderPage.slugId}
        title={folderPage.title}
        spaceSlug={currentSpaceSlug}
        editable={!readOnly}
      />

      <Stack p="md" gap="sm" className={classes.contentArea}>
        <Group justify="space-between" align="center" className={classes.toolbar}>
          <Text size="sm" className={classes.metaText}>
            {children.length} items
          </Text>

          {!readOnly && (
            <Group gap="xs" className={classes.createActions}>
              <Button
                size="xs"
                leftSection={<IconFileText size={15} stroke={1.75} />}
                loading={creatingNodeType === "file"}
                onClick={() => handleCreateChild("file")}
              >
                New file
              </Button>
              <Button
                size="xs"
                variant="default"
                leftSection={<IconFolder size={15} stroke={1.75} />}
                loading={creatingNodeType === "folder"}
                onClick={() => handleCreateChild("folder")}
              >
                New folder
              </Button>
            </Group>
          )}
        </Group>

        <Paper withBorder radius="lg" p="xs" className={classes.itemsPanel}>
          {isLoading && !data ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          ) : children.length === 0 ? (
            <Text size="sm" py="md" ta="center" className={classes.emptyState}>
              No items in this folder.
            </Text>
          ) : (
            <Stack gap={6}>
              {children.map((item) => (
                <Anchor
                  key={item.id}
                  component={Link}
                  to={buildPageUrl(currentSpaceSlug, item.slugId, item.title)}
                  underline="never"
                  className={classes.itemLink}
                >
                  <Group
                    justify="space-between"
                    wrap="nowrap"
                    px="xs"
                    py={8}
                    className={classes.itemRow}
                  >
                    <Group wrap="nowrap" gap={10} className={classes.itemMain}>
                      {item.icon ? (
                        <span className={classes.customIcon}>{item.icon}</span>
                      ) : (
                        <span className={classes.systemIcon}>
                          {item.nodeType === "folder" ? (
                            <IconFolder size={15} stroke={1.75} />
                          ) : (
                            <IconFileText size={15} stroke={1.75} />
                          )}
                        </span>
                      )}
                      <Text size="sm" className={classes.itemTitle}>
                        {item.title || t("untitled")}
                      </Text>
                    </Group>

                    {item.isPinned ? (
                      <IconPin size={13} stroke={1.75} className={classes.pinIcon} />
                    ) : null}
                  </Group>
                </Anchor>
              ))}
            </Stack>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}
