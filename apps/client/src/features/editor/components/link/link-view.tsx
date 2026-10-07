import { MarkViewContent, MarkViewProps } from "@tiptap/react";
import { getMarkRange } from "@tiptap/core";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  IconFileDescription,
  IconCopy,
  IconExternalLink,
  IconLinkOff,
  IconPencil,
  IconWorld,
} from "@tabler/icons-react";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { notifications } from "@mantine/notifications";
import {
  Divider,
  Group,
  Popover,
  Text,
  TextInput,
  ActionIcon,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import classes from "./link.module.css";
import { useTranslation } from "react-i18next";
import { INTERNAL_LINK_REGEX } from "@/lib/constants";
import { LinkEditorPanel } from "@/features/editor/components/link/link-editor-panel.tsx";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { useSharePageQuery } from "@/features/share/queries/share-query.ts";
import { usePublicSpacePageQuery } from "@/features/public-space/queries/public-space-query.ts";
import {
  buildPageUrl,
  buildPublicSpaceUrl,
  buildSharedPageUrl,
} from "@/features/page/page.utils.ts";
import { extractPageSlugId } from "@/lib";
import {
  matchIntegrationLink,
  sanitizeUrl,
  copyToClipboard,
  isEditorReady,
} from "@docmost/editor-ext";
import { normalizeUrl } from "@/lib/utils";
import { useInstalledIntegrations } from "@/features/integration/queries/integration-query";
import {
  convertIntegrationDisplay,
  getIntegrationCardAvailability,
  type IntegrationDisplaySource,
} from "@/features/editor/components/integration-link/integration-display";
import { IntegrationDisplayMenu } from "@/features/editor/components/integration-link/integration-display-picker";

const parseInternalLink = (
  href: string,
  internalAttr?: boolean,
): { isInternal: boolean; slugId: string | null; label: string } => {
  if (!href) return { isInternal: !!internalAttr, slugId: null, label: "" };

  const match = INTERNAL_LINK_REGEX.exec(href);
  if (!match) {
    if (internalAttr) return { isInternal: true, slugId: null, label: href };
    return { isInternal: false, slugId: null, label: href };
  }

  const isExternal = match[2] && match[2] !== window.location.host;
  const slug = match[5];
  const slugId = extractPageSlugId(slug);
  const namePart = slug.split("-").slice(0, -1).join("-");

  return {
    isInternal: !isExternal,
    slugId,
    label: namePart || slug,
  };
};

export default function LinkView(props: MarkViewProps) {
  const { mark, editor } = props;
  const href = mark.attrs.href as string;
  const navigate = useNavigate();
  const location = useLocation();
  const { shareId, spaceSlug, pageSlug } = useParams();
  const { t } = useTranslation();
  const isShareRoute = location.pathname.startsWith("/share");
  const isPublicSpaceRoute = location.pathname.startsWith("/docs/");

  const [popoverState, setPopoverState] = useState<
    "closed" | "preview" | "edit"
  >("closed");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const lastOpenState = useRef<"preview" | "edit">("preview");
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isEditable = editor.isEditable;
  const integrationMatch = useMemo(() => matchIntegrationLink(href), [href]);
  const markIntegrationProvider =
    typeof mark.attrs.integrationProvider === "string"
      ? mark.attrs.integrationProvider
      : null;
  const { data: installedIntegrations } = useInstalledIntegrations(
    Boolean(markIntegrationProvider || integrationMatch) && isEditable,
  );
  // Only hosts an installed provider unfurls get "Display as".
  const hostIntegrationProvider = useMemo(() => {
    if (!installedIntegrations) return null;
    const unfurlHosts = Object.fromEntries(
      installedIntegrations
        .filter((integration) => integration.unfurlHosts)
        .map((integration) => [integration.type, integration.unfurlHosts]),
    );
    return matchIntegrationLink(href, unfurlHosts)?.provider ?? null;
  }, [href, installedIntegrations]);
  const detectedIntegrationProvider =
    markIntegrationProvider ?? hostIntegrationProvider;
  const integrationProvider = installedIntegrations?.some(
    (integration) => integration.type === detectedIntegrationProvider,
  )
    ? detectedIntegrationProvider
    : null;
  const {
    isInternal,
    slugId,
    label: linkLabel,
  } = parseInternalLink(href, mark.attrs.internal);

  const isPopoverVisible = popoverState !== "closed";
  const activeView = isPopoverVisible ? popoverState : lastOpenState.current;

  const { data: linkedPage } = usePageQuery({
    pageId:
      isPopoverVisible && slugId && !isShareRoute && !isPublicSpaceRoute
        ? slugId
        : null,
  });

  const { data: sharedPageData } = useSharePageQuery({
    pageId: isPopoverVisible && slugId && isShareRoute ? slugId : null,
  });

  // Resolved eagerly (not gated on the popover): an unresolvable target must
  // render as inert text rather than a link that dead-ends at /login.
  const { data: publicSpacePageData } = usePublicSpacePageQuery({
    spaceSlug: isPublicSpaceRoute && slugId ? spaceSlug : undefined,
    pageSlugId: slugId,
    contentless: true,
  });

  const isUnresolvedPublicLink =
    isPublicSpaceRoute && isInternal && !publicSpacePageData?.page && !slugId;

  let pageTitle = linkedPage?.title;
  if (isShareRoute) {
    pageTitle = sharedPageData?.page?.title;
  } else if (isPublicSpaceRoute) {
    pageTitle = publicSpacePageData?.page?.title;
  }

  const pendingTitleRef = useRef<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const getLinkPos = useCallback((): number | null => {
    if (!wrapperRef.current) return null;
    try {
      const pos = editor.view.posAtDOM(wrapperRef.current, 0);
      return pos >= 0 && pos <= editor.state.doc.content.size ? pos : null;
    } catch {
      return null;
    }
  }, [editor]);

  const getIntegrationSource = useCallback((): Extract<
    IntegrationDisplaySource,
    { kind: "link" }
  > | null => {
    if (!integrationProvider) return null;

    const pos = getLinkPos();
    if (pos === null) return null;

    const range = getMarkRange(editor.state.doc.resolve(pos), mark.type, {
      href,
    });
    if (!range) return null;

    return {
      kind: "link",
      from: range.from,
      to: range.to,
      url: href,
      provider: integrationProvider,
    };
  }, [editor, getLinkPos, href, integrationProvider, mark.type]);

  const handleUpdateLinkTitle = useCallback(
    (newTitle: string) => {
      if (!newTitle) return;

      const pos = getLinkPos();
      if (pos === null) return;

      const { state } = editor;
      const resolved = state.doc.resolve(pos);
      const node = resolved.nodeAfter;
      if (!node?.isText) return;

      const linkMark = node.marks.find(
        (m) => m.type.name === "link" && m.attrs.href === href,
      );
      if (!linkMark || node.text === newTitle) return;

      const from = pos;
      const to = pos + node.nodeSize;
      const { tr } = state;
      tr.insertText(newTitle, from, to);
      tr.addMark(from, from + newTitle.length, linkMark);
      editor.view.dispatch(tr);
    },
    [editor, href, getLinkPos],
  );

  const handleEditLink = useCallback(
    (url: string, internal?: boolean) => {
      const normalizedUrl = internal ? url : normalizeUrl(url);

      const pos = getLinkPos();
      if (pos === null) {
        setPopoverState("closed");
        return;
      }

      const { state } = editor;
      const resolved = state.doc.resolve(pos);
      const node = resolved.nodeAfter;
      if (!node?.isText) {
        setPopoverState("closed");
        return;
      }

      const linkMark = node.marks.find(
        (m) => m.type.name === "link" && m.attrs.href === href,
      );
      if (linkMark) {
        const from = pos;
        const to = pos + node.nodeSize;
        const { tr } = state;
        tr.removeMark(from, to, linkMark.type);
        tr.addMark(
          from,
          to,
          linkMark.type.create({ href: normalizedUrl, internal: !!internal }),
        );
        editor.view.dispatch(tr);
      }

      setPopoverState("closed");
    },
    [editor, href, getLinkPos],
  );

  useEffect(() => {
    if (popoverState === "edit") {
      const text = wrapperRef.current?.querySelector("a")?.textContent || "";
      setLinkTitle(text);
      setLinkUrl(href);
      pendingTitleRef.current = null;
      requestAnimationFrame(() => titleInputRef.current?.focus());
    }
    if (popoverState === "closed") {
      if (pendingTitleRef.current !== null) {
        handleUpdateLinkTitle(pendingTitleRef.current);
        pendingTitleRef.current = null;
      }
      setShowSearch(false);
    }
  }, [popoverState, href, isInternal, handleUpdateLinkTitle]);

  useEffect(() => {
    if (popoverState !== "closed") {
      lastOpenState.current = popoverState;
    }
  }, [popoverState]);

  useEffect(() => {
    if (!isPopoverVisible) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current?.contains(target) ||
        dropdownRef.current?.contains(target) ||
        (target instanceof Element &&
          target.closest("[data-integration-display-menu-dropdown]"))
      ) {
        return;
      }
      setPopoverState("closed");
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (
          e.target instanceof Element &&
          e.target.closest("[data-integration-display-menu-dropdown]")
        ) {
          return;
        }
        setPopoverState("closed");
      }
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleEscape, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [isPopoverVisible]);

  const handleNavigate = useCallback(() => {
    if (!href) return;

    if (isInternal) {
      let targetPath = href;
      let anchor = "";

      try {
        const url = new URL(href);
        targetPath = url.pathname;
        anchor = url.hash.slice(1);
      } catch {
        if (href.includes("#")) {
          [targetPath, anchor] = href.split("#");
        }
      }

      if (anchor) {
        const currentPageSlugId = extractPageSlugId(pageSlug);
        if (!slugId || currentPageSlugId === slugId) {
          const element =
            document.querySelector(`[id="${anchor}"]`) ||
            document.querySelector(`[data-id="${anchor}"]`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
            navigate(`${location.pathname}#${anchor}`, { replace: true });
            return;
          }
        }
      }

      if (isShareRoute && slugId) {
        const sharedUrl = buildSharedPageUrl({
          shareId,
          pageSlugId: slugId,
          pageTitle: pageTitle,
          anchorId: anchor || undefined,
        });
        navigate(sharedUrl);
      } else if (isPublicSpaceRoute) {
        if (slugId && publicSpacePageData?.page) {
          navigate(
            buildPublicSpaceUrl({
              // cross-space targets resolve to their own space's public URL
              spaceSlug: publicSpacePageData.space?.slug ?? spaceSlug,
              pageSlugId: slugId,
              pageTitle: pageTitle,
              anchorId: anchor || undefined,
            }),
          );
        } else if (slugId) {
          // no public URL: the /p/ resolver redirects members straight to the
          // page and funnels anonymous visitors through login first; a new tab
          // keeps the docs tab's history intact through that redirect chain
          window.open(
            buildPageUrl(undefined, slugId, pageTitle, anchor || undefined),
            "_blank",
            "noopener,noreferrer",
          );
        }
      } else {
        navigate(anchor ? `${targetPath}#${anchor}` : targetPath);
      }
    } else {
      window.open(
        sanitizeUrl(normalizeUrl(href)),
        "_blank",
        "noopener,noreferrer",
      );
    }
  }, [
    href,
    navigate,
    location.pathname,
    isInternal,
    isShareRoute,
    isPublicSpaceRoute,
    slugId,
    shareId,
    spaceSlug,
    publicSpacePageData,
    pageTitle,
    pageSlug,
  ]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isEditable) {
        setPopoverState("preview");
      } else {
        handleNavigate();
      }
    },
    [handleNavigate, isEditable],
  );

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const fullUrl = sanitizeUrl(
        isInternal ? `${window.location.origin}${href}` : href,
      );
      copyToClipboard(fullUrl);
      notifications.show({
        message: t("Link copied"),
      });
      setPopoverState("closed");
    },
    [href, isInternal, t],
  );

  const handleRemoveLink = useCallback(() => {
    if (isEditorReady(editor)) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    setPopoverState("closed");
  }, [editor]);

  const handleIntegrationDisplay = useCallback(
    (display: "card" | "mention" | "url") => {
      const source = getIntegrationSource();
      setPopoverState("closed");
      if (!source || display === "url") {
        editor.commands.focus(undefined, { scrollIntoView: false });
        return;
      }

      if (convertIntegrationDisplay(editor, source, display)) {
        editor.commands.focus(undefined, { scrollIntoView: false });
      }
    },
    [editor, getIntegrationSource],
  );

  const internalHref = () => {
    if (isShareRoute && slugId) {
      return buildSharedPageUrl({ shareId, pageSlugId: slugId, pageTitle });
    }
    if (isPublicSpaceRoute && slugId && publicSpacePageData?.page) {
      return buildPublicSpaceUrl({ spaceSlug, pageSlugId: slugId, pageTitle });
    }
    return href;
  };

  const displayHref = sanitizeUrl(
    isInternal ? internalHref() : normalizeUrl(href),
  );

  const linkTitleInput = (
    <>
      <Text size="xs" fw={600} c="dimmed" mt="sm" mb={4}>
        {t("Link title")}
      </Text>
      <TextInput
        ref={titleInputRef}
        classNames={{ input: classes.linkInput }}
        value={linkTitle}
        onChange={(e) => {
          const val = e.currentTarget.value;
          setLinkTitle(val);
          pendingTitleRef.current = val;
          const anchor = wrapperRef.current?.querySelector("a");
          if (anchor && val) {
            const walker = document.createTreeWalker(
              anchor,
              NodeFilter.SHOW_TEXT,
            );
            const textNode = walker.nextNode();
            if (textNode && isEditorReady(editor)) {
              const view = editor.view as any;
              view.domObserver.stop();
              textNode.nodeValue = val;
              view.domObserver.start();
            }
          }
        }}
        onBlur={() => {
          if (pendingTitleRef.current !== null) {
            handleUpdateLinkTitle(pendingTitleRef.current);
            pendingTitleRef.current = null;
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleUpdateLinkTitle(linkTitle);
            pendingTitleRef.current = null;
            setPopoverState("closed");
          }
        }}
        size="sm"
      />
    </>
  );

  // Targets outside the published space have no public URL, so the label is
  // rendered as inert text instead of a link that dead-ends at /login.
  if (isUnresolvedPublicLink) {
    return (
      <span ref={wrapperRef} className={classes.linkWrapper}>
        <MarkViewContent />
      </span>
    );
  }

  return (
    <Popover
      opened={isPopoverVisible}
      width={
        activeView === "edit"
          ? "min(320px, calc(100vw - 24px))"
          : integrationProvider
            ? "min(340px, calc(100vw - 24px))"
            : undefined
      }
      position="bottom"
      withArrow
      shadow="md"
      trapFocus={false}
      closeOnClickOutside={false}
    >
      <Popover.Target>
        <span
          ref={wrapperRef}
          className={classes.linkWrapper}
          data-active={isPopoverVisible || undefined}
          onClick={handleClick}
        >
          <a
            href={displayHref}
            spellCheck={false}
            onClick={(e) => e.preventDefault()}
            target={isInternal ? undefined : "_blank"}
            rel={isInternal ? undefined : "noopener noreferrer"}
          >
            <MarkViewContent />
          </a>
        </span>
      </Popover.Target>

      <Popover.Dropdown
        ref={dropdownRef}
        p={activeView === "edit" ? "sm" : 6}
        className={
          activeView === "preview" && integrationProvider
            ? classes.integrationPopover
            : undefined
        }
        onMouseDown={(e) => e.stopPropagation()}
      >
        {activeView === "edit" ? (
          <>
            <Text size="xs" fw={600} c="dimmed" mb={4}>
              {t("Page or URL")}
            </Text>

            {isInternal ? (
              !showSearch ? (
                <>
                  <UnstyledButton
                    className={classes.linkChip}
                    onClick={() => setShowSearch(true)}
                  >
                    <IconFileDescription
                      size={16}
                      stroke={1.5}
                      color="var(--mantine-color-dimmed)"
                      style={{ flexShrink: 0 }}
                    />
                    <Text size="sm" fw={500} truncate>
                      {pageTitle || linkTitle}
                    </Text>
                  </UnstyledButton>

                  {linkTitleInput}

                  <Divider my="xs" />

                  <UnstyledButton
                    onClick={handleRemoveLink}
                    className={classes.removeLink}
                  >
                    <Group gap={8}>
                      <IconLinkOff size={16} stroke={1.5} />
                      <Text size="sm">{t("Remove link")}</Text>
                    </Group>
                  </UnstyledButton>
                </>
              ) : (
                <LinkEditorPanel
                  onSetLink={handleEditLink}
                  onUnsetLink={handleRemoveLink}
                />
              )
            ) : (
              <>
                <TextInput
                  leftSection={
                    <IconWorld
                      size={16}
                      stroke={1.5}
                      color="var(--mantine-color-dimmed)"
                    />
                  }
                  classNames={{ input: classes.linkInput }}
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.currentTarget.value)}
                  onBlur={() => {
                    if (linkUrl && linkUrl !== href) {
                      handleEditLink(linkUrl, false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (linkUrl && linkUrl !== href) {
                        handleEditLink(linkUrl, false);
                      }
                    }
                  }}
                  size="sm"
                />

                {linkTitleInput}

                <Divider my="xs" />

                <UnstyledButton
                  onClick={handleRemoveLink}
                  className={classes.removeLink}
                >
                  <Group gap={8}>
                    <IconLinkOff size={16} stroke={1.5} />
                    <Text size="sm">{t("Remove link")}</Text>
                  </Group>
                </UnstyledButton>
              </>
            )}
          </>
        ) : (
          <Group gap={2} wrap="nowrap" className={classes.previewRow}>
            <Group
              component="a"
              //@ts-ignore
              href={displayHref}
              target={isInternal ? undefined : "_blank"}
              rel={isInternal ? undefined : "noopener noreferrer"}
              gap={6}
              wrap="nowrap"
              className={classes.previewDestination}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                handleNavigate();
              }}
            >
              {isInternal ? (
                <IconFileDescription size={18} color="gray" />
              ) : (
                <IconExternalLink size={18} color="gray" />
              )}
              <Text size="sm" truncate fw={500}>
                {isInternal ? pageTitle || linkLabel : href}
              </Text>
            </Group>

            <Divider
              orientation="vertical"
              className={classes.previewDivider}
            />

            {isPopoverVisible &&
              integrationProvider &&
              (() => {
                const source = getIntegrationSource();
                const cardAvailability = source
                  ? getIntegrationCardAvailability(editor, source)
                  : null;

                return (
                  <IntegrationDisplayMenu
                    current="url"
                    label={t("Display as")}
                    canUseCard={cardAvailability?.canUseCard ?? false}
                    onChange={handleIntegrationDisplay}
                  />
                );
              })()}

            <Tooltip label={t("Edit link")} withArrow withinPortal={false}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size={32}
                className={classes.previewAction}
                aria-label={t("Edit link")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSearch(false);
                  setPopoverState("edit");
                }}
              >
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label={t("Copy link")} withArrow withinPortal={false}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size={32}
                className={classes.previewAction}
                aria-label={t("Copy link")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCopy(e);
                }}
              >
                <IconCopy size={18} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label={t("Remove link")} withArrow withinPortal={false}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size={32}
                className={classes.previewAction}
                aria-label={t("Remove link")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemoveLink();
                }}
              >
                <IconLinkOff size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
