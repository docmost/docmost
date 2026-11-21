import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useComputedColorScheme } from "@mantine/core";
import clsx from "clsx";
import {
  HTML_BLOCK_ALLOW,
  HTML_BLOCK_LOADING_HEIGHT,
  HTML_BLOCK_MIN_HEIGHT,
  HTML_BLOCK_PROBE_MS,
  HTML_BLOCK_SANDBOX,
} from "@/ee/html-block/html-block.constants";
import { buildHtmlBlockSrcdoc } from "@/ee/html-block/utils/html-block-srcdoc";
import {
  clampHtmlBlockHeight,
  createFitController,
  readHeightMessage,
} from "@/ee/html-block/utils/html-block-height";
import { HtmlBlockFrameTheme } from "@/ee/html-block/types/html-block.types";
import classes from "./html-block-frame.module.css";

type HtmlBlockFrameProps = {
  html: string;
  height: number | "fill" | null;
  title: string;
};

export function HtmlBlockFrame({ html, height, title }: HtmlBlockFrameProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const colorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: false,
  });
  const [theme, setTheme] = useState<HtmlBlockFrameTheme | null>(null);
  const [fittedHeight, setFittedHeight] = useState(HTML_BLOCK_LOADING_HEIGHT);
  const [fitController] = useState(() => createFitController());
  const fit = height === null;

  useLayoutEffect(() => {
    const textRoot = rootRef.current?.closest(".ProseMirror") ?? document.body;
    const style = getComputedStyle(textRoot);
    setTheme({
      colorScheme,
      fontFamily: style.fontFamily,
      textColor: style.color,
      fontSize: style.fontSize,
    });
  }, [colorScheme]);

  const srcdoc = useMemo(
    () => (theme ? buildHtmlBlockSrcdoc(html, theme) : null),
    [html, theme],
  );

  // subscribed during commit so the frame's first height message is never missed
  useLayoutEffect(() => {
    if (!srcdoc) return;

    fitController.reset();
    let probeTimer: ReturnType<typeof setTimeout> | undefined;
    let frameRequest: number | undefined;
    let pendingHeight = HTML_BLOCK_MIN_HEIGHT;

    const applyHeight = (next: number) => {
      pendingHeight = next;
      if (frameRequest !== undefined) return;
      frameRequest = requestAnimationFrame(() => {
        frameRequest = undefined;
        setFittedHeight(pendingHeight);
      });
    };

    const handleMessage = (event: MessageEvent) => {
      const reported = readHeightMessage(
        event,
        iframeRef.current?.contentWindow ?? null,
      );
      if (reported === null) return;

      clearTimeout(probeTimer);
      if (!fit) {
        applyHeight(reported);
        return;
      }

      const next = fitController.report(reported, performance.now());
      if (next !== null) applyHeight(next);
      if (fitController.state === "probing") {
        probeTimer = setTimeout(
          () => fitController.probeTimedOut(),
          HTML_BLOCK_PROBE_MS,
        );
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(probeTimer);
      if (frameRequest !== undefined) cancelAnimationFrame(frameRequest);
    };
  }, [srcdoc, fit, fitController]);

  const frameHeight =
    height === "fill"
      ? "100%"
      : `${fit ? fittedHeight : clampHtmlBlockHeight(height)}px`;

  return (
    <div
      ref={rootRef}
      className={clsx(classes.root, height === "fill" && classes.fill)}
    >
      {srcdoc !== null && (
        <iframe
          ref={iframeRef}
          className={classes.frame}
          style={{ height: frameHeight }}
          srcDoc={srcdoc}
          title={title}
          sandbox={HTML_BLOCK_SANDBOX}
          allow={HTML_BLOCK_ALLOW}
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}
