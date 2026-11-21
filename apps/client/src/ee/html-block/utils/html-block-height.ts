import {
  HTML_BLOCK_GROWTH_WINDOW_MS,
  HTML_BLOCK_MAX_FIT_HEIGHT,
  HTML_BLOCK_MAX_FIXED_HEIGHT,
  HTML_BLOCK_MESSAGE_TYPE,
  HTML_BLOCK_MIN_FIXED_HEIGHT,
  HTML_BLOCK_MIN_HEIGHT,
  HTML_BLOCK_SUSPICION_GROWTHS,
} from "@/ee/html-block/html-block.constants";
import {
  HtmlBlockFitController,
  HtmlBlockFitState,
} from "@/ee/html-block/types/html-block.types";

const utf8Encoder = new TextEncoder();

export function clampHtmlBlockHeight(height: number): number {
  return Math.min(
    HTML_BLOCK_MAX_FIT_HEIGHT,
    Math.max(HTML_BLOCK_MIN_HEIGHT, height),
  );
}

export function clampHtmlBlockFixedHeight(height: number): number {
  return Math.round(
    Math.min(
      HTML_BLOCK_MAX_FIXED_HEIGHT,
      Math.max(HTML_BLOCK_MIN_FIXED_HEIGHT, height),
    ),
  );
}

export function readHeightMessage(
  event: MessageEvent,
  frameWindow: Window | null,
): number | null {
  if (!frameWindow || event.source !== frameWindow) return null;

  const data = event.data;
  if (data?.type !== HTML_BLOCK_MESSAGE_TYPE) return null;
  if (typeof data.height !== "number" || !Number.isFinite(data.height)) {
    return null;
  }

  return clampHtmlBlockHeight(Math.ceil(data.height));
}

export function createFitController({
  suspicionGrowths = HTML_BLOCK_SUSPICION_GROWTHS,
  windowMs = HTML_BLOCK_GROWTH_WINDOW_MS,
}: { suspicionGrowths?: number; windowMs?: number } = {}): HtmlBlockFitController {
  let state: HtmlBlockFitState = "fitting";
  let lastHeight: number | null = null;
  let growthTimes: number[] = [];

  return {
    get state() {
      return state;
    },

    report(height, now) {
      if (state === "fitting" && (lastHeight === null || height > lastHeight)) {
        growthTimes = growthTimes.filter((time) => now - time < windowMs);
        if (growthTimes.length >= suspicionGrowths) {
          state = "probing";
          return null;
        }
        growthTimes.push(now);
      } else {
        // while probing or frozen the frame held still, so this change came from the content
        state = "fitting";
        growthTimes = [];
      }

      lastHeight = height;
      return height;
    },

    probeTimedOut() {
      if (state === "probing") state = "frozen";
    },

    reset() {
      state = "fitting";
      lastHeight = null;
      growthTimes = [];
    },
  };
}

export function utf8ByteLength(text: string): number {
  return utf8Encoder.encode(text).length;
}
