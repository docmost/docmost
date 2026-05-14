import { useCallback, useEffect, useRef, useState } from "react";
import { ActionIcon, Tooltip, Text } from "@mantine/core";
import {
  IconMinus,
  IconPlus,
  IconMaximize,
  IconMinimize,
  IconFocusCentered,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "./zoomable-svg.module.css";
import clsx from "clsx";

interface ZoomableSvgProps {
  children: React.ReactNode;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.15;

export default function ZoomableSvg({ children }: ZoomableSvgProps) {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const touchRef = useRef<{
    startDist: number;
    startScale: number;
    centerX: number;
    centerY: number;
    startOffsetX: number;
    startOffsetY: number;
    isSingleFinger: boolean;
    startX: number;
    startY: number;
  } | null>(null);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const applyTransform = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    }
  }, [scale, offsetX, offsetY]);

  useEffect(() => {
    applyTransform();
  }, [applyTransform]);

  // Show "Click to zoom with scroll" hint when user scrolls without focus or Ctrl
  const flashHint = useCallback(() => {
    setShowHint(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setShowHint(false), 1500);
  }, []);

  // Click outside to un-focus
  useEffect(() => {
    if (!isFocused) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFocused]);

  // Native wheel listener (need { passive: false } to preventDefault)
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      // Zoom when: Ctrl/Meta held, OR the viewport is focused (clicked)
      if (!e.ctrlKey && !e.metaKey && !isFocused) {
        // Let the page scroll normally; show hint
        flashHint();
        return;
      }

      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldX = (mouseX - offsetX) / scale;
      const worldY = (mouseY - offsetY) / scale;

      const direction = e.deltaY < 0 ? 1 : -1;
      const newScale = clampScale(scale * (1 + direction * ZOOM_STEP));

      setScale(newScale);
      setOffsetX(mouseX - worldX * newScale);
      setOffsetY(mouseY - worldY * newScale);
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [scale, offsetX, offsetY, flashHint, isFocused]);

  // Mouse drag start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY, offsetX, offsetY };
    },
    [offsetX, offsetY],
  );

  // Mouse drag move & end
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setOffsetX(dragStartRef.current.offsetX + e.clientX - dragStartRef.current.x);
      setOffsetY(dragStartRef.current.offsetY + e.clientY - dragStartRef.current.y);
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Touch gestures
  // - Two-finger pinch: always zoom
  // - Single finger drag: only pan when zoomed in (scale != 1) to preserve page scrolling
  const getTouchDistance = (t1: Touch, t2: Touch) =>
    Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const offsetRef = useRef({ x: offsetX, y: offsetY });
  offsetRef.current = { x: offsetX, y: offsetY };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = getTouchDistance(e.touches[0], e.touches[1]);
        const rect = viewport.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        touchRef.current = {
          startDist: d,
          startScale: scaleRef.current,
          centerX: cx,
          centerY: cy,
          startOffsetX: offsetRef.current.x,
          startOffsetY: offsetRef.current.y,
          isSingleFinger: false,
          startX: 0,
          startY: 0,
        };
      } else if (e.touches.length === 1) {
        // Always allow single-finger pan (touch-action: none prevents browser scroll)
        e.preventDefault();
        touchRef.current = {
          startDist: 0,
          startScale: scaleRef.current,
          centerX: 0,
          centerY: 0,
          startOffsetX: offsetRef.current.x,
          startOffsetY: offsetRef.current.y,
          isSingleFinger: true,
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchRef.current) return;
      e.preventDefault();

      if (e.touches.length === 2 && !touchRef.current.isSingleFinger) {
        const d = getTouchDistance(e.touches[0], e.touches[1]);
        const ratio = d / touchRef.current.startDist;
        const newScale = clampScale(touchRef.current.startScale * ratio);
        const { centerX, centerY, startOffsetX, startOffsetY, startScale } =
          touchRef.current;
        const worldX = (centerX - startOffsetX) / startScale;
        const worldY = (centerY - startOffsetY) / startScale;
        setScale(newScale);
        setOffsetX(centerX - worldX * newScale);
        setOffsetY(centerY - worldY * newScale);
      } else if (e.touches.length === 1 && touchRef.current.isSingleFinger) {
        const dx = e.touches[0].clientX - touchRef.current.startX;
        const dy = e.touches[0].clientY - touchRef.current.startY;
        setOffsetX(touchRef.current.startOffsetX + dx);
        setOffsetY(touchRef.current.startOffsetY + dy);
      }
    };

    const handleTouchEnd = () => {
      touchRef.current = null;
    };

    viewport.addEventListener("touchstart", handleTouchStart, { passive: false });
    viewport.addEventListener("touchmove", handleTouchMove, { passive: false });
    viewport.addEventListener("touchend", handleTouchEnd);
    return () => {
      viewport.removeEventListener("touchstart", handleTouchStart);
      viewport.removeEventListener("touchmove", handleTouchMove);
      viewport.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isFullscreen, scale, offsetX, offsetY]);

  // Button zoom (center-based)
  const zoomFromCenter = useCallback(
    (direction: 1 | -1) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const worldX = (cx - offsetX) / scale;
      const worldY = (cy - offsetY) / scale;
      const newScale = clampScale(scale * (1 + direction * ZOOM_STEP));
      setScale(newScale);
      setOffsetX(cx - worldX * newScale);
      setOffsetY(cy - worldY * newScale);
    },
    [scale, offsetX, offsetY],
  );

  const resetView = useCallback(() => {
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
  }, []);

  // Fullscreen – use CSS-only approach (position:fixed) for reliability on mobile
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Lock body scroll & request landscape when in CSS fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
      // Try to lock to landscape on mobile
      screen.orientation?.lock?.("landscape").catch(() => {});
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") setIsFullscreen(false);
      };
      document.addEventListener("keydown", handleEsc);
      return () => {
        document.body.style.overflow = "";
        screen.orientation?.unlock?.();
        document.removeEventListener("keydown", handleEsc);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isFullscreen]);

  return (
    <div
      ref={wrapperRef}
      className={clsx(classes.wrapper, isFullscreen && classes.fullscreenContainer)}
    >
      <div className={classes.toolbar}>
        <Tooltip label={t("Zoom out")} position="bottom" withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => zoomFromCenter(-1)}
          >
            <IconMinus size={14} />
          </ActionIcon>
        </Tooltip>

        <span className={classes.zoomLabel}>{Math.round(scale * 100)}%</span>

        <Tooltip label={t("Zoom in")} position="bottom" withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => zoomFromCenter(1)}
          >
            <IconPlus size={14} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label={t("Reset")} position="bottom" withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={resetView}
          >
            <IconFocusCentered size={14} />
          </ActionIcon>
        </Tooltip>

        <Tooltip
          label={isFullscreen ? t("Exit fullscreen") : t("Fullscreen")}
          position="bottom"
          withArrow
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? (
              <IconMinimize size={14} />
            ) : (
              <IconMaximize size={14} />
            )}
          </ActionIcon>
        </Tooltip>
      </div>

      <div
        ref={viewportRef}
        className={clsx(classes.viewport, isFocused && classes.viewportFocused)}
        onMouseDown={(e) => {
          setIsFocused(true);
          handleMouseDown(e);
        }}
      >
        <div ref={contentRef} className={classes.content}>
          {children}
        </div>
        {showHint && (
          <div className={classes.hint}>
            <Text size="xs">{t("Click to enable scroll zoom")}</Text>
          </div>
        )}
      </div>
    </div>
  );
}
