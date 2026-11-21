import { describe, expect, it } from "vitest";
import {
  createFitController,
  readHeightMessage,
  utf8ByteLength,
} from "./html-block-height";
import { HTML_BLOCK_MESSAGE_TYPE } from "../html-block.constants";

const frameWindow = {} as Window;

const message = (data: unknown, source: Window | null = frameWindow) =>
  new MessageEvent("message", { data, source });

const heightMessage = (height: unknown) =>
  message({ type: HTML_BLOCK_MESSAGE_TYPE, height });

describe("readHeightMessage", () => {
  it("reads the height the frame reports", () => {
    expect(readHeightMessage(heightMessage(320), frameWindow)).toBe(320);
  });

  it("rounds a fractional height up", () => {
    expect(readHeightMessage(heightMessage(320.2), frameWindow)).toBe(321);
  });

  it("ignores messages from other windows", () => {
    const data = { type: HTML_BLOCK_MESSAGE_TYPE, height: 320 };

    expect(readHeightMessage(message(data, {} as Window), frameWindow)).toBeNull();
    expect(readHeightMessage(message(data, null), frameWindow)).toBeNull();
    expect(readHeightMessage(message(data), null)).toBeNull();
  });

  it("ignores messages of another type", () => {
    expect(
      readHeightMessage(message({ type: "resize", height: 320 }), frameWindow),
    ).toBeNull();
    expect(readHeightMessage(message("320"), frameWindow)).toBeNull();
    expect(readHeightMessage(message(null), frameWindow)).toBeNull();
  });

  it("ignores heights that are not finite numbers", () => {
    for (const height of ["320", NaN, Infinity, -Infinity, null, undefined, {}]) {
      expect(readHeightMessage(heightMessage(height), frameWindow)).toBeNull();
    }
  });

  it("clamps heights to 40 and 12000", () => {
    expect(readHeightMessage(heightMessage(0), frameWindow)).toBe(40);
    expect(readHeightMessage(heightMessage(-500), frameWindow)).toBe(40);
    expect(readHeightMessage(heightMessage(12001), frameWindow)).toBe(12000);
    expect(readHeightMessage(heightMessage(1e9), frameWindow)).toBe(12000);
  });
});

describe("createFitController", () => {
  // eight rising reports 50 ms apart, the streak just below suspicion
  const growEightTimes = (
    controller: ReturnType<typeof createFitController>,
    from: number,
    start = 0,
  ) => {
    for (let i = 0; i < 8; i++) {
      expect(controller.report(from + i * 18, start + i * 50)).toBe(
        from + i * 18,
      );
    }
  };

  it("stops fitting after a feedback loop", () => {
    const controller = createFitController();

    growEightTimes(controller, 58);
    expect(controller.report(202, 400)).toBeNull();
    expect(controller.state).toBe("probing");

    controller.probeTimedOut();
    expect(controller.state).toBe("frozen");

    controller.probeTimedOut();
    expect(controller.state).toBe("frozen");
  });

  it("keeps fitting while content animates", () => {
    const controller = createFitController();

    growEightTimes(controller, 100);
    expect(controller.report(260, 400)).toBeNull();
    expect(controller.state).toBe("probing");

    expect(controller.report(280, 416)).toBe(280);
    expect(controller.state).toBe("fitting");
    growEightTimes(controller, 300, 432);
    expect(controller.state).toBe("fitting");
  });

  it("resumes from frozen on a content-driven report", () => {
    const controller = createFitController();

    growEightTimes(controller, 58);
    controller.report(202, 400);
    controller.probeTimedOut();

    expect(controller.report(150, 5000)).toBe(150);
    expect(controller.state).toBe("fitting");
  });

  it("growth spread over time never trips", () => {
    const controller = createFitController();

    for (let i = 0; i < 30; i++) {
      expect(controller.report(100 + i * 20, i * 400)).toBe(100 + i * 20);
    }
    expect(controller.state).toBe("fitting");
  });

  it("starts the streak again on a repeated or lower height", () => {
    const controller = createFitController();

    growEightTimes(controller, 100);
    expect(controller.report(226, 400)).toBe(226);
    growEightTimes(controller, 230, 450);
    expect(controller.report(100, 850)).toBe(100);
    growEightTimes(controller, 110, 900);
    expect(controller.state).toBe("fitting");
  });

  it("reset clears state", () => {
    const controller = createFitController();

    growEightTimes(controller, 300);
    controller.report(500, 400);
    controller.probeTimedOut();

    controller.reset();
    expect(controller.state).toBe("fitting");
    growEightTimes(controller, 50, 450);
    expect(controller.report(200, 850)).toBeNull();
    expect(controller.state).toBe("probing");
  });

  it("takes custom limits", () => {
    const controller = createFitController({ suspicionGrowths: 2, windowMs: 100 });

    expect(controller.report(100, 0)).toBe(100);
    expect(controller.report(200, 10)).toBe(200);
    expect(controller.report(300, 20)).toBeNull();
    expect(controller.report(400, 30)).toBe(400);
    expect(controller.report(500, 200)).toBe(500);
    expect(controller.report(600, 210)).toBe(600);
  });
});

describe("utf8ByteLength", () => {
  it("counts utf-8 bytes", () => {
    expect(utf8ByteLength("")).toBe(0);
    expect(utf8ByteLength("<p>Hi</p>")).toBe(9);
    expect(utf8ByteLength("é")).toBe(2);
    expect(utf8ByteLength("Größe")).toBe(7);
    expect(utf8ByteLength("€")).toBe(3);
    expect(utf8ByteLength("😀")).toBe(4);
    expect(utf8ByteLength("a😀é")).toBe(7);
  });
});
