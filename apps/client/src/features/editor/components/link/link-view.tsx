import { MarkViewContent, MarkViewProps } from "@tiptap/react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  IconFileDescription,
  IconCopy,
  IconExternalLink,
  IconLinkOff,
} from "@tabler/icons-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useLongPress } from "@/features/editor/hooks/use-long-press";
import { notifications } from "@mantine/notifications";
import {
  Card,
  Group,
  Button,
  TextInput,
  Text,
  ActionIcon,
  Stack,
  CloseButton,
  Tooltip,
} from "@mantine/core";
import classes from "./link.module.css";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { INTERNAL_LINK_REGEX } from "@/lib/constants";

const isTouchDevice = () => {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
};

const isInternalLink = (href: string): boolean => {
  if (!href) return false;
  const match = INTERNAL_LINK_REGEX.exec(href);
  if (!match) return false;

  return !(match[2] && match[2] !== window.location.host);
};

const extractLinkLabel = (href: string): string => {
  if (!href) return "";

  const match = INTERNAL_LINK_REGEX.exec(href);
  if (match) {
    const slug = match[5];
    // Extract page name from slug (remove the ID suffix)
    const namePart = slug.split("-").slice(0, -1).join("-");
    return namePart || slug;
  }

  // For external links, show domain
  try {
    const url = new URL(href);
    return url.hostname.replace("www.", "");
  } catch {
    return href.slice(0, 30);
  }
};

export default function LinkView(props: MarkViewProps) {
  const { mark, editor } = props;
  const href = mark.attrs.href as string;
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [isHovered, setIsHovered] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editUrl, setEditUrl] = useState(href);
  const [editTitle, setEditTitle] = useState("");
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouch = isTouchDevice();
  const isEditable = editor.isEditable;
  const isInternal = isInternalLink(href);

  const getLinkText = useCallback(() => {
    const { state } = editor;
    let text = "";
    state.doc.descendants((node) => {
      const linkMark = node.marks.find(
        (m) => m.type.name === "link" && m.attrs.href === href,
      );
      if (linkMark && node.isText) {
        text = node.text || "";
        return false;
      }
    });
    return text;
  }, [editor, href]);

  useEffect(() => {
    if (showEditPanel) {
      setEditUrl(href);
      setEditTitle(getLinkText());
    }
  }, [showEditPanel, href, getLinkText]);

  const handleMouseEnter = useCallback(() => {
    if (showEditPanel) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  }, [showEditPanel]);

  const handleMouseLeave = useCallback(() => {
    if (showEditPanel) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 200);
  }, [showEditPanel]);

  const handleNavigate = useCallback(() => {
    if (!href) return;

    if (isInternal) {
      // Get pathname for navigation (handle both relative and absolute URLs)
      let targetPath = href;
      let anchor = "";

      try {
        const url = new URL(href);
        targetPath = url.pathname;
        anchor = url.hash.slice(1); // Remove the # prefix
      } catch {
        // Relative URL
        if (href.includes("#")) {
          [targetPath, anchor] = href.split("#");
        }
      }

      // Handle anchor links on same page
      if (anchor) {
        const currentPath = location.pathname;
        if (!targetPath || targetPath === currentPath) {
          const element = document.getElementById(anchor);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
            navigate(`${currentPath}#${anchor}`, { replace: true });
            return;
          }
        }
      }

      navigate(anchor ? `${targetPath}#${anchor}` : targetPath);
    } else {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }, [href, navigate, location.pathname, isInternal]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!showEditPanel) {
        handleNavigate();
      }
    },
    [handleNavigate, showEditPanel],
  );

  const handleLongPress = useCallback(() => {
    if (isEditable) {
      setShowEditPanel(true);
      setIsHovered(false);
    }
  }, [isEditable]);

  const handleTapNavigate = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      if (!showEditPanel) {
        handleNavigate();
      }
    },
    [handleNavigate, showEditPanel],
  );

  const longPressHandlers = useLongPress({
    threshold: 500,
    onLongPress: handleLongPress,
    onClick: handleTapNavigate,
  });

  const handleOpenEdit = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowEditPanel(true);
    setIsHovered(false);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setShowEditPanel(false);
  }, []);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const fullUrl = isInternal ? `${window.location.origin}${href}` : href;
      navigator.clipboard.writeText(fullUrl);
      notifications.show({
        message: t("Link copied to clipboard"),
        color: "green",
        autoClose: 2000,
      });
    },
    [href, isInternal, t],
  );

  const handleSave = useCallback(() => {
    const { state } = editor;
    const { tr } = state;

    let updated = false;
    state.doc.descendants((node, pos) => {
      if (updated) return false;

      const linkMark = node.marks.find(
        (m) => m.type.name === "link" && m.attrs.href === href,
      );
      if (linkMark && node.isText) {
        const from = pos;
        const to = pos + node.nodeSize;

        if (editUrl !== href) {
          tr.removeMark(from, to, linkMark.type);
          tr.addMark(from, to, linkMark.type.create({ href: editUrl }));
        }

        const currentText = node.text || "";
        if (editTitle && editTitle !== currentText) {
          tr.replaceWith(
            from,
            to,
            state.schema.text(editTitle, [
              linkMark.type.create({ href: editUrl || href }),
            ]),
          );
        }

        updated = true;
        return false;
      }
    });

    if (updated) {
      editor.view.dispatch(tr);
    }

    setShowEditPanel(false);
  }, [editor, href, editUrl, editTitle]);

  const handleRemoveLink = useCallback(() => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setShowEditPanel(false);
  }, [editor]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Stop all keyboard events from bubbling to TipTap editor
      e.stopPropagation();

      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCloseEdit();
      }
    },
    [handleSave, handleCloseEdit],
  );

  const interactionProps = isTouch
    ? { ...longPressHandlers }
    : {
        onClick: handleClick,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
      };

  const linkLabel = extractLinkLabel(href);

  return (
    <>
      <span
        ref={wrapperRef}
        className={classes.linkWrapper}
        {...interactionProps}
      >
        <a
          href={href}
          className={classes.linkText}
          onClick={(e) => e.preventDefault()}
          target={isInternal ? undefined : "_blank"}
          rel={isInternal ? undefined : "noopener noreferrer"}
        >
          <MarkViewContent />
        </a>

        {/* Hover Toolbar */}
        {isEditable && !isTouch && isHovered && !showEditPanel && (
          <span
            contentEditable={false}
            className={classes.linkToolbar}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <Card shadow="md" padding="xs" radius="md" withBorder>
              <Group gap="xs" wrap="nowrap">
                <Group
                  gap={6}
                  wrap="nowrap"
                  style={{ cursor: "pointer", maxWidth: 180 }}
                  onClick={handleNavigate}
                >
                  {isInternal ? (
                    <IconFileDescription size={18} color="gray" />
                  ) : (
                    <IconExternalLink size={18} color="gray" />
                  )}
                  <Text size="sm" truncate fw={500}>
                    {linkLabel}
                  </Text>
                </Group>

                <Tooltip label={t("Copy link")} withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={handleCopy}
                  >
                    <IconCopy size={18} />
                  </ActionIcon>
                </Tooltip>

                <Tooltip label={t("Remove link")} withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={handleRemoveLink}
                  >
                    <IconLinkOff size={18} />
                  </ActionIcon>
                </Tooltip>

                <Button size="xs" variant="subtle" onClick={handleOpenEdit}>
                  {t("Edit")}
                </Button>
              </Group>
            </Card>
          </span>
        )}

        {/* Edit Panel */}
        {isEditable && showEditPanel && (
          <>
            {createPortal(
              <div
                className={classes.editPanelOverlay}
                onClick={handleCloseEdit}
              />,
              document.body,
            )}
            <div
              contentEditable={false}
              className={classes.editPanel}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              <Card shadow="md" padding="md" radius="md" withBorder w={320}>
                <Stack gap="md">
                  <TextInput
                    label={t("Search or paste a link")}
                    placeholder="https://..."
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rightSection={
                      editUrl && (
                        <CloseButton size="sm" onClick={() => setEditUrl("")} />
                      )
                    }
                    autoFocus
                    withAsterisk
                  />

                  <TextInput
                    label={t("Display text (optional)")}
                    description={t("Give this link a title or description")}
                    placeholder={t("Text to display")}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />

                  <Group justify="flex-end" gap="xs">
                    <Button
                      variant="default"
                      onClick={handleCloseEdit}
                      size="sm"
                    >
                      {t("Cancel")}
                    </Button>
                    <Button onClick={handleSave} size="sm">
                      {t("Save")}
                    </Button>
                  </Group>
                </Stack>
              </Card>
            </div>
          </>
        )}
      </span>
    </>
  );
}
