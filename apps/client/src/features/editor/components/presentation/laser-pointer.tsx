import { useRef } from "react";
import { useWindowEvent } from "@mantine/hooks";
import classes from "./presentation-modal.module.css";

type LaserPointerProps = {
  enabled: boolean;
};

export default function LaserPointer({ enabled }: LaserPointerProps) {
  const dotRef = useRef<HTMLDivElement>(null);

  useWindowEvent("pointermove", (event) => {
    const dot = dotRef.current;
    if (!dot) return;
    dot.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    dot.style.visibility = event.pointerType === "touch" ? "hidden" : "visible";
  });

  useWindowEvent("pointerout", (event) => {
    // the page gets no pointer events outside the window or over an embed
    const leftPage =
      !event.relatedTarget || event.relatedTarget instanceof HTMLIFrameElement;
    if (leftPage && dotRef.current) {
      dotRef.current.style.visibility = "hidden";
    }
  });

  return (
    <div
      ref={dotRef}
      className={classes.laserPointer}
      hidden={!enabled}
      aria-hidden="true"
    />
  );
}
