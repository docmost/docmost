import {
  PointerEvent as ReactPointerEvent,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import dayjs from "dayjs";
import type { ScheduleEventData } from "@mantine/schedule";
import {
  DateResize,
  DayRange,
  getMonthEventDayRange,
  resizeDayRange,
} from "@/ee/base/services/calendar-date-math";

export type ResizeEdge = DateResize["edge"];
type ResizeEdges = Record<ResizeEdge, boolean>;

type EventMod = { hanging?: "start" | "end" | "both" | "none" };
type SegmentMod = { "clip-start"?: boolean; "clip-end"?: boolean };

export function getCalendarDateAt(
  x: number,
  y: number,
  within?: Element | null,
): string | null {
  for (const element of document.elementsFromPoint(x, y)) {
    if (
      element instanceof HTMLElement &&
      element.dataset.calendarDate &&
      (!within || within.contains(element))
    ) {
      return element.dataset.calendarDate;
    }
  }
  return null;
}

export function getResizeEdges(mod: unknown): ResizeEdges | null {
  const [eventMod, segmentMod] = (Array.isArray(mod) ? mod : []) as [
    EventMod | undefined,
    SegmentMod | undefined,
  ];
  if (!eventMod || !segmentMod) return null;
  const { hanging } = eventMod;
  return {
    start: hanging !== "start" && hanging !== "both" && !segmentMod["clip-start"],
    end: hanging !== "end" && hanging !== "both" && !segmentMod["clip-end"],
  };
}

export function useCalendarMonthResize(
  rootRef: RefObject<HTMLElement | null>,
  onEventResize?: (eventId: string, resize: DateResize) => void,
) {
  const [resizeRange, setResizeRange] = useState<DayRange | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeIntentRef = useRef(false);
  const justResizedRef = useRef(false);
  const endGestureRef = useRef<(() => void) | null>(null);
  const onEventResizeRef = useRef(onEventResize);
  useLayoutEffect(() => {
    onEventResizeRef.current = onEventResize;
  });
  useEffect(() => () => endGestureRef.current?.(), []);

  const startResize = useCallback(
    (
      event: ScheduleEventData,
      edge: ResizeEdge,
      pointerEvent: ReactPointerEvent<HTMLElement>,
    ) => {
      if (pointerEvent.button !== 0 || pointerEvent.pointerType === "touch") return;
      endGestureRef.current?.();
      pointerEvent.preventDefault();
      pointerEvent.stopPropagation();
      const handle = pointerEvent.currentTarget;
      const { pointerId } = pointerEvent;
      const span = getMonthEventDayRange(event.start, event.end);
      let range = span;
      let moved = false;
      let cancelled = false;

      const handlePointerMove = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        if ((e.buttons & 1) === 0) {
          endGesture();
          return;
        }
        if (cancelled) return;
        const day = getCalendarDateAt(e.clientX, e.clientY, rootRef.current);
        if (!day) return;
        const next = resizeDayRange(span, edge, day);
        if (next[0] === range[0] && next[1] === range[1]) return;
        range = next;
        if (!moved) {
          moved = true;
          setIsResizing(true);
        }
        setResizeRange(next);
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (cancelled || e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        cancelled = true;
        setResizeRange(null);
      };
      const endGesture = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
        window.removeEventListener("keydown", handleKeyDown, true);
        window.removeEventListener("blur", endGesture);
        if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        resizeIntentRef.current = false;
        endGestureRef.current = null;
        setResizeRange(null);
        setIsResizing(false);
      };
      const handlePointerUp = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        endGesture();
        if (moved || cancelled) {
          justResizedRef.current = true;
          requestAnimationFrame(() => {
            justResizedRef.current = false;
          });
        }
        const fromDay = edge === "start" ? span[0] : span[1];
        const toDay = edge === "start" ? range[0] : range[1];
        if (!cancelled && toDay !== fromDay) {
          onEventResizeRef.current?.(String(event.id), {
            edge,
            fromDay,
            toDay,
            displayEnd: dayjs(event.end).format("YYYY-MM-DD HH:mm:ss"),
          });
        }
      };
      const handlePointerCancel = (e: PointerEvent) => {
        if (e.pointerId === pointerId) endGesture();
      };

      handle.setPointerCapture(pointerId);
      resizeIntentRef.current = true;
      endGestureRef.current = endGesture;
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
      window.addEventListener("keydown", handleKeyDown, true);
      window.addEventListener("blur", endGesture);
    },
    [rootRef],
  );

  const wasResizing = useCallback(() => justResizedRef.current, []);

  return { resizeRange, isResizing, resizeIntentRef, wasResizing, startResize };
}
