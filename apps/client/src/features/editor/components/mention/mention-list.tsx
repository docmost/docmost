import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchSuggestionsQuery } from "@/features/search/queries/search-query.ts";
import {
  ActionIcon,
  Group,
  Paper,
  ScrollArea,
  Text,
  UnstyledButton,
} from "@mantine/core";
import clsx from "clsx";
import classes from "./mention.module.css";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { IconFileDescription, IconPlus } from "@tabler/icons-react";
import { useSpaceQuery } from "@/features/space/queries/space-query.ts";
import { useParams } from "react-router-dom";
import { v7 as uuid7 } from "uuid";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import {
  MentionListProps,
  MentionSuggestionItem,
} from "@/features/editor/components/mention/mention.type.ts";
import { IPage } from "@/features/page/types/page.types";
import { useCreatePageMutation, usePageQuery } from "@/features/page/queries/page-query";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";
import { SimpleTree } from "react-arborist";
import { SpaceTreeNode } from "@/features/page/tree/types";
import { useTranslation } from "react-i18next";
import { useQueryEmit } from "@/features/websocket/use-query-emit";
import { extractPageSlugId } from "@/lib";

const MentionList = forwardRef<any, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const { pageSlug, spaceSlug } = useParams();
  const { data: page } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const { data: space } = useSpaceQuery(spaceSlug);
  const [currentUser] = useAtom(currentUserAtom);
  const [renderItems, setRenderItems] = useState<MentionSuggestionItem[]>([]);
  const { t } = useTranslation();
  const [data, setData] = useAtom(treeDataAtom);
  const tree = useMemo(() => new SimpleTree<SpaceTreeNode>(data), [data]);
  const createPageMutation = useCreatePageMutation();
  const emit = useQueryEmit();

  const { data: suggestion, isLoading } = useSearchSuggestionsQuery({
    query: props.query,
    includeUsers: true,
    includePages: true,
    spaceId: space.id,
    limit: 10,
  });

  const createPageItem = (label: string) : MentionSuggestionItem => {
    return {
      id: null,
      label: label,
      entityType: "page",
      entityId: null,
      slugId: null,
      icon: null,
    }
  }

  useEffect(() => {
    if (suggestion && !isLoading) {
      let items: MentionSuggestionItem[] = [];

      if (suggestion?.users?.length > 0) {
        items.push({ entityType: "header", label: t("Users") });

        items = items.concat(
          suggestion.users.map((user) => ({
            id: uuid7(),
            label: user.name,
            entityType: "user",
            entityId: user.id,
            avatarUrl: user.avatarUrl,
          })),
        );
      }

      if (suggestion?.pages?.length > 0) {
        items.push({ entityType: "header", label: t("Pages") });
        items = items.concat(
          suggestion.pages.map((page) => ({
            id: uuid7(),
            label: page.title || "Untitled",
            entityType: "page",
            entityId: page.id,
            slugId: page.slugId,
            icon: page.icon,
          })),
        );
      }
      items.push(createPageItem(props.query));

      setRenderItems(items);
      // update editor storage
      //@ts-ignore
      props.editor.storage.mentionItems = items;
    }
  }, [suggestion, isLoading]);

  const selectItem = useCallback(
    (index: number) => {
      const item = renderItems?.[index];
      if (item) {
        if (item.entityType === "user") {
          props.command({
            id: item.id,
            label: item.label,
            entityType: "user",
            entityId: item.entityId,
            creatorId: currentUser?.user.id,
          });
        }
        if (item.entityType === "page" && item.id!==null) {
          props.command({
            id: item.id,
            label: item.label || "Untitled",
            entityType: "page",
            entityId: item.entityId,
            slugId: item.slugId,
            creatorId: currentUser?.user.id,
          });
        }
        if (item.entityType === "page" && item.id===null) {
          createPage(item.label);
        }
      }
    },
    [renderItems],
  );

  const upHandler = () => {
    if (!renderItems.length) return;

    let newIndex = selectedIndex;

    do {
      newIndex = (newIndex + renderItems.length - 1) % renderItems.length;
    } while (renderItems[newIndex].entityType === "header");
    setSelectedIndex(newIndex);
  };

  const downHandler = () => {
    if (!renderItems.length) return;
    let newIndex = selectedIndex;
    do {
      newIndex = (newIndex + 1) % renderItems.length;
    } while (renderItems[newIndex].entityType === "header");
    setSelectedIndex(newIndex);
  };

  const enterHandler = () => {
    if (!renderItems.length) return;
    if (renderItems[selectedIndex]?.entityType !== "header") {
      selectItem(selectedIndex);
    }
  };

  useEffect(() => {
    setSelectedIndex(1);
  }, [suggestion]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }

      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }

      if (event.key === "Enter") {
        // don't trap the enter button if there are no items to render
        if (renderItems.length === 0) {
          return false;
        }
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  const createPage = async (title: string) => {
    const payload: { spaceId: string; parentPageId?: string; title: string } = {
      spaceId: space.id,
      parentPageId: page.id || null,
      title: title
    };

    let createdPage: IPage;
    try {
      createdPage = await createPageMutation.mutateAsync(payload);
      const parentId = page.id || null;
      const data = {
        id: createdPage.id,
        slugId: createdPage.slugId,
        name: createdPage.title,
        position: createdPage.position,
        spaceId: createdPage.spaceId,
        parentPageId: createdPage.parentPageId,
        children: [],
      } as any;

      const lastIndex = tree.data.length;

      tree.create({ parentId, index: lastIndex, data });
      setData(tree.data);

      props.command({
        id: uuid7(),
        label:  createdPage.title || "Untitled",
        entityType: "page",
        entityId: createdPage.id,
        slugId: createdPage.slugId,
        creatorId: currentUser?.user.id,
      });

      setTimeout(() => {
      emit({
        operation: "addTreeNode",
        spaceId: space.id,
        payload: {
          parentId,
          index: lastIndex,
          data,
        },
      });
    }, 50);

    } catch (err) {
      throw new Error("Failed to create page");
    }
  }

  // if no results and enter what to do?

  useEffect(() => {
    viewportRef.current
      ?.querySelector(`[data-item-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (renderItems.length === 0) {
    return (
      <Paper shadow="md" p="xs" withBorder>
        { t("No results") }
      </Paper>
    );
  }

  return (
    <Paper id="mention" shadow="md" p="xs" withBorder>
      <ScrollArea.Autosize
        viewportRef={viewportRef}
        mah={350}
        w={320}
        scrollbarSize={8}
      >
        {renderItems?.map((item, index) => {
          if (item.entityType === "header") {
            return (
              <div key={`${item.label}-${index}`}>
                <Text c="dimmed" mb={4} tt="uppercase">
                  {item.label}
                </Text>
              </div>
            );
          } else if (item.entityType === "user") {
            return (
              <UnstyledButton
                data-item-index={index}
                key={index}
                onClick={() => selectItem(index)}
                className={clsx(classes.menuBtn, {
                  [classes.selectedItem]: index === selectedIndex,
                })}
              >
                <Group>
                  <CustomAvatar
                    size={"sm"}
                    avatarUrl={item.avatarUrl}
                    name={item.label}
                  />

                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>
                      {item.label}
                    </Text>
                  </div>
                </Group>
              </UnstyledButton>
            );
          } else if (item.entityType === "page") {
            return (
              <UnstyledButton
                data-item-index={index}
                key={index}
                onClick={() => selectItem(index)}
                className={clsx(classes.menuBtn, {
                  [classes.selectedItem]: index === selectedIndex,
                })}
              >
                <Group>
                  <ActionIcon
                    variant="default"
                    component="div"
                    aria-label={item.label}
                  >
                    {item.icon || (
                      <ActionIcon
                        component="span"
                        variant="transparent"
                        color="gray"
                        size={18}
                      >
                        { (item.id) ? <IconFileDescription size={18} /> : <IconPlus size={18} /> }
                      </ActionIcon>
                    )}
                  </ActionIcon>

                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>
                      { (item.id) ? item.label : t("Create page") + ': ' + item.label }
                    </Text>
                  </div>
                </Group>
              </UnstyledButton>
            );
          } else {
            return null;
          }
        })}
      </ScrollArea.Autosize>
    </Paper>
  );
});

export default MentionList;
