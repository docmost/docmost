import { DragEvent as ReactDragEvent, ReactNode, Ref } from "react";
import clsx from "clsx";
import classes from "@/ee/base/styles/calendar-frame.module.css";

const CALENDAR_EVENT_DRAG_TYPE = "application/json";

type CalendarFrameProps = {
  embedded?: boolean;
  header?: ReactNode;
  surfaceRef?: Ref<HTMLDivElement>;
  children: ReactNode;
};

const CALENDAR_ROOT_SELECTOR = "[data-calendar-root]";
const CONTAINED_DRAG_EVENT_TYPES = new Set(["dragenter", "dragover", "drop"]);

export function isCalendarEventDrag(event: Event): boolean {
  return (
    CONTAINED_DRAG_EVENT_TYPES.has(event.type) &&
    event instanceof DragEvent &&
    !!event.dataTransfer?.types.includes(CALENDAR_EVENT_DRAG_TYPE) &&
    event.target instanceof Element &&
    !!event.target.closest(CALENDAR_ROOT_SELECTOR)
  );
}

function containEventDrag(event: ReactDragEvent<HTMLDivElement>) {
  if (event.dataTransfer.types.includes(CALENDAR_EVENT_DRAG_TYPE)) {
    event.stopPropagation();
  }
}

export function CalendarFrame({ embedded, header, surfaceRef, children }: CalendarFrameProps) {
  return (
    <div
      data-calendar-root
      className={clsx(classes.calendar, embedded ? classes.calendarEmbed : classes.calendarFullPage)}
      onDragEnter={containEventDrag}
      onDragOver={containEventDrag}
      onDrop={containEventDrag}
    >
      <div className={classes.header}>{header}</div>
      <div ref={surfaceRef} className={classes.surface}>
        {children}
      </div>
    </div>
  );
}
