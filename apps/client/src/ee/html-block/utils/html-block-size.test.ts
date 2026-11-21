import { describe, expect, it } from "vitest";
import { formatHtmlBlockSize } from "./html-block-size";
import { HTML_BLOCK_MAX_BYTES } from "../html-block.constants";

describe("formatHtmlBlockSize", () => {
  it("shows whole kilobytes below one megabyte", () => {
    expect(formatHtmlBlockSize(0)).toBe("0 KB");
    expect(formatHtmlBlockSize(1)).toBe("1 KB");
    expect(formatHtmlBlockSize(1024)).toBe("1 KB");
    expect(formatHtmlBlockSize(1025)).toBe("2 KB");
    expect(formatHtmlBlockSize(1023 * 1024)).toBe("1023 KB");
  });

  it("switches to megabytes instead of showing 1024 KB", () => {
    expect(formatHtmlBlockSize(1023 * 1024 + 1)).toBe("1.0 MB");
    expect(formatHtmlBlockSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });

  it("never shows a size over the limit as the limit", () => {
    expect(formatHtmlBlockSize(HTML_BLOCK_MAX_BYTES)).toBe("5.0 MB");
    expect(formatHtmlBlockSize(HTML_BLOCK_MAX_BYTES + 1)).toBe("5.1 MB");
  });
});
