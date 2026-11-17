import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Activity } from "react";
import { MantineProvider } from "@mantine/core";
import type { NodeViewProps } from "@tiptap/react";
import AudioView from "./audio-view";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// the real one starts loading locale files over HTTP
vi.mock("@/i18n.ts", () => ({ default: { t: (key: string) => key } }));

const props = {
  node: {
    attrs: {
      src: "/api/files/019a4f3e-0000-7000-8000-000000000006/standup.mp3",
      name: "standup.mp3",
      size: 1024,
    },
  },
} as unknown as NodeViewProps;

function view(mode: "visible" | "hidden") {
  return (
    <MantineProvider env="test">
      <Activity mode={mode}>
        <AudioView {...props} />
      </Activity>
    </MantineProvider>
  );
}

// jsdom does not play media, so the element reports what a playing one would
function startPlaying(audio: HTMLAudioElement, position: number) {
  Object.defineProperty(audio, "duration", { configurable: true, value: 754 });
  Object.defineProperty(audio, "paused", { configurable: true, value: false });
  Object.defineProperty(audio, "currentTime", {
    configurable: true,
    writable: true,
    value: position,
  });
  fireEvent(audio, new Event("loadedmetadata"));
  fireEvent(audio, new Event("play"));
  fireEvent(audio, new Event("timeupdate"));
}

describe("AudioView", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(cleanup);

  it("still shows a playing file after its effects run again", () => {
    const { container, rerender } = render(view("visible"));
    startPlaying(container.querySelector("audio")!, 54);
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();

    // keeps the state and the element but runs the effects again, as a hot reload does
    rerender(view("hidden"));
    rerender(view("visible"));

    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    expect(container.textContent).toContain("0:54");
    expect(container.textContent).toContain("12:34");
  });
});
