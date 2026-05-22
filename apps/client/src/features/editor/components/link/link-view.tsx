import { MarkViewContent, MarkViewProps } from "@tiptap/react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  IconFileDescription,
  IconCopy,
  IconExternalLink,
  IconLinkOff,
  IconPencil,
  IconWorld,
} from "@tabler/icons-react";
import { useState, useCallback, useRef, useEffect } from "react";
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
import { buildSharedPageUrl } from "@/features/page/page.utils.ts";
import { extractPageSlugId } from "@/lib";
import { sanitizeUrl, copyToClipboard } from "@docmost/editor-ext";
import { normalizeUrl } from "@/lib/utils";

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
  const { shareId, pageSlug } = useParams();
  const { t } = useTranslation();
  const isShareRoute = location.pathname.startsWith("/share");

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
  const {
    isInternal,
    slugId,
    label: linkLabel,
  } = parseInternalLink(href, mark.attrs.internal);

  const isPopoverVisible = popoverState !== "closed";
  const activeView = isPopoverVisible ? popoverState : lastOpenState.current;

  const { data: linkedPage } = usePageQuery({
    pageId: isPopoverVisible && slugId && !isShareRoute ? slugId : null,
  });

  const { data: sharedPageData } = useSharePageQuery({
    pageId: isPopoverVisible && slugId && isShareRoute ? slugId : null,
  });

  const pageTitle = isShareRoute
    ? sharedPageData?.page?.title
    : linkedPage?.title;

  const pendingTitleRef = useRef<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const getLinkPos = useCallback((): number | null => {
    if (!wrapperRef.current) return null;
    try {
      return editor.view.posAtDOM(wrapperRef.current, 0);
    } catch {
      return null;
    }
  }, [editor]);

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
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setPopoverState("closed");
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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
    slugId,
    shareId,
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
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setPopoverState("closed");
  }, [editor]);

  const displayHref = sanitizeUrl(
    isInternal
      ? isShareRoute && slugId
        ? buildSharedPageUrl({ shareId, pageSlugId: slugId, pageTitle })
        : href
      : normalizeUrl(href),
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
            if (textNode) {
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

  return (
    <Popover
      opened={isPopoverVisible}
      width={activeView === "edit" ? 320 : undefined}
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
          <Group gap={4} wrap="nowrap">
            <Group
              component="a"
              //@ts-ignore
              href={displayHref}
              target={isInternal ? undefined : "_blank"}
              rel={isInternal ? undefined : "noopener noreferrer"}
              gap={6}
              wrap="nowrap"
              style={{
                cursor: "pointer",
                maxWidth: 250,
                textDecoration: "none",
                color: "inherit",
                userSelect: "none",
              }}
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

            <Divider orientation="vertical" />

            <Tooltip label={t("Edit link")} withArrow withinPortal={false}>
              <ActionIcon
                variant="subtle"
                color="gray"
                onMouseDown={(e) => {
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
                onMouseDown={(e) => {
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
                onMouseDown={(e) => {
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
