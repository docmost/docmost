import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Group,
  ScrollArea,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconFileDescription, IconLink, IconWorld } from "@tabler/icons-react";
import { useLinkEditorState } from "@/features/editor/components/link/use-link-editor-state.tsx";
import { LinkEditorPanelProps } from "@/features/editor/components/link/types.ts";
import { useTranslation } from "react-i18next";
import { useSearchSuggestionsQuery } from "@/features/search/queries/search-query.ts";
import { useSpaceQuery } from "@/features/space/queries/space-query.ts";
import { useParams } from "react-router-dom";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { AutoTooltipText } from "@/components/ui/auto-tooltip-text.tsx";
import clsx from "clsx";
import classes from "./link.module.css";

export const LinkEditorPanel = ({
  onSetLink,
  initialUrl,
  onUnsetLink,
}: LinkEditorPanelProps) => {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const { data: space } = useSpaceQuery(spaceSlug);
  const state = useLinkEditorState({ onSetLink, initialUrl });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const { data: suggestion } = useSearchSuggestionsQuery({
    query: state.isSearchQuery ? state.url : "",
    includeUsers: false,
    includePages: true,
    spaceId: space?.id,
    limit: state.isSearchQuery ? 10 : 3,
    preload: true,
  });

  const pages: Partial<IPage>[] = suggestion?.pages ?? [];

  useEffect(() => {
    setSelectedIndex(0);
  }, [pages.length]);

  const selectPage = useCallback(
    (page: Partial<IPage>) => {
      const url = buildPageUrl(
        page.space?.slug || spaceSlug,
        page.slugId,
        page.title,
      );
      onSetLink(url, true);
    },
    [onSetLink, spaceSlug],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const hasUrlItem = state.url.length > 0 && (state.isValidUrl || state.isSearchQuery);
      const total = (hasUrlItem ? 1 : 0) + (state.isValidUrl ? 0 : pages.length);
      if (total === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, total - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (hasUrlItem && selectedIndex === 0) {
          onSetLink(state.url, false);
        } else {
          const pageIndex = hasUrlItem ? selectedIndex - 1 : selectedIndex;
          if (pageIndex >= 0 && pageIndex < pages.length) {
            selectPage(pages[pageIndex]);
          }
        }
      }
    },
    [pages, selectedIndex, selectPage, state.isValidUrl, state.isSearchQuery, state.url, onSetLink],
  );

  useEffect(() => {
    viewportRef.current
      ?.querySelector(`[data-item-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const showPages = pages.length > 0 && !state.isValidUrl;
  const showUrlItem = state.url.length > 0 && (state.isValidUrl || state.isSearchQuery);
  const showDropdown = showPages || showUrlItem;

  return (
    <div>
      <form onSubmit={state.handleSubmit}>
        <TextInput
          leftSection={<IconLink size={16} stroke={1.5} color="var(--mantine-color-dimmed)" />}
          classNames={{ input: classes.linkInput }}
          placeholder={t("Paste link or search pages")}
          value={state.url}
          onChange={state.onChange}
          onKeyDown={handleKeyDown}
          data-autofocus
          autoFocus
        />
      </form>

      {showDropdown && (
        <>
          {!state.isSearchQuery && !state.isValidUrl && (
            <Text c="dimmed" size="xs" fw={600} px="sm" pt={10} pb={4}>
              {t("Recents")}
            </Text>
          )}

          <ScrollArea.Autosize
            viewportRef={viewportRef}
            mah={300}
            scrollbars="y"
            scrollbarSize={6}
            mt={state.url.length > 0 ? 8 : 0}
            styles={{ content: { minWidth: 0 } }}
          >
            {showUrlItem && (
              <UnstyledButton
                data-item-index={0}
                onClick={() => onSetLink(state.url, false)}
                className={clsx(classes.searchItem, {
                  [classes.selectedSearchItem]: selectedIndex === 0,
                })}
              >
                <Group gap={10} wrap="nowrap" align="flex-start">
                  <span className={classes.pageIcon}>
                    <IconWorld size={18} stroke={1.5} />
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} truncate lh={1.3}>
                      {state.url}
                    </Text>
                    <Text size="xs" c="dimmed" lh={1.4}>
                      {t("Link to web page")}
                    </Text>
                  </div>
                </Group>
              </UnstyledButton>
            )}

            {!state.isValidUrl && pages.map((page, index) => {
              const itemIndex = showUrlItem ? index + 1 : index;
              return (
                <UnstyledButton
                  data-item-index={itemIndex}
                  key={page.id || index}
                  onClick={() => selectPage(page)}
                  className={clsx(classes.searchItem, {
                    [classes.selectedSearchItem]: itemIndex === selectedIndex,
                  })}
                >
                  <Group gap={10} wrap="nowrap" align="flex-start">
                    <span className={classes.pageIcon}>
                      {page.icon || <IconFileDescription size={18} stroke={1.5} />}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <AutoTooltipText size="sm" fw={500} truncate lh={1.3}>
                        {page.title || t("Untitled")}
                      </AutoTooltipText>
                      {page.space?.name && (
                        <AutoTooltipText size="xs" c="dimmed" truncate lh={1.4}>
                          {page.space.name}
                        </AutoTooltipText>
                      )}
                    </div>
                  </Group>
                </UnstyledButton>
              );
            })}
          </ScrollArea.Autosize>
        </>
      )}

      {onUnsetLink && (
        <UnstyledButton
          onClick={onUnsetLink}
          className={classes.removeLink}
        >
          <Text size="sm" c="red">
            {t("Remove link")}
          </Text>
        </UnstyledButton>
      )}
    </div>
  );
};
