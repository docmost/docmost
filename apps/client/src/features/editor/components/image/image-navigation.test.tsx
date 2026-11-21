import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import ReadonlyPageEditor from "../../readonly-page-editor";

// Exercise the actual resizable image node and read-only page renderer.
vi.mock("@/features/editor/extensions/extensions", async () => {
  const { Document } = await import("@tiptap/extension-document");
  const { Paragraph } = await import("@tiptap/extension-paragraph");
  const { Text } = await import("@tiptap/extension-text");
  const { TiptapImage } = await import("@docmost/editor-ext");
  return {
    mainExtensions: [
      Document,
      Paragraph,
      Text,
      TiptapImage.configure({ resize: { enabled: true } }),
    ],
  };
});
vi.mock("../microsoft/microsoft-fullscreen-modal.tsx", () => ({
  MicrosoftFullscreenModal: () => null,
}));

afterEach(cleanup);

const originPage = "/s/demo/p/step-eight";
const nextPage = "/s/demo/p/step-nine?view=full#rollback";

function CurrentLocation() {
  const { pathname, search, hash } = useLocation();
  return <output>{pathname + search + hash}</output>;
}

function showPage(href: string, shareId?: string, spaceSlug?: string) {
  render(
    <MemoryRouter initialEntries={[originPage]}>
      <CurrentLocation />
      <ReadonlyPageEditor
        title="Step eight"
        shareId={shareId}
        spaceSlug={spaceSlug}
        content={{
          type: "doc",
          content: [
            { type: "image", attrs: { src: "/next.jpg", href, alt: "Next" } },
          ],
        }}
      />
    </MemoryRouter>,
  );
  return screen.getByRole("img", { name: "Next" });
}

it.each([
  [nextPage, undefined, undefined, nextPage],
  [
    window.location.origin + nextPage,
    "demo-share",
    undefined,
    "/share/demo-share/p/step-nine?view=full#rollback",
  ],
  [nextPage, undefined, "demo", "/docs/demo/step-nine?view=full#rollback"],
])(
  "routes the rendered image to %s using its displayed destination",
  (href, shareId, spaceSlug, destination) => {
    const image = showPage(href, shareId, spaceSlug);
    expect(image.closest("a")?.getAttribute("href")).toBe(destination);
    expect(fireEvent.click(image)).toBe(false);
    expect(screen.getByRole("status").textContent).toBe(destination);
  },
);

it.each<[string, MouseEventInit]>([
  ["https://another.example/s/demo/p/step-nine", {}],
  ["/api/files/demo/next.jpg", {}],
  [nextPage, { ctrlKey: true }],
  [nextPage, { metaKey: true }],
  [nextPage, { shiftKey: true }],
  [nextPage, { altKey: true }],
  [nextPage, { button: 1 }],
])("leaves native clicks available for %s with %o", (href, init) => {
  const image = showPage(href);
  // Observe whether the editor consumed the event before jsdom follows the link.
  let consumed: boolean | undefined;
  document.addEventListener(
    "click",
    (event) => {
      consumed = event.defaultPrevented;
      event.preventDefault();
    },
    { once: true },
  );
  fireEvent.click(image, init);
  expect(consumed).toBe(false);
  expect(screen.getByRole("status").textContent).toBe(originPage);
});
