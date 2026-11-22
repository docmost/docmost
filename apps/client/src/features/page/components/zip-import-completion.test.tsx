import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { IFileTask } from "@/features/file-task/types/file-task.types";
import { notifyZipImportComplete } from "./zip-import-completion";

const { show, update, hide, saveAs } = vi.hoisted(() => ({
  show: vi.fn(),
  update: vi.fn(),
  hide: vi.fn(),
  saveAs: vi.fn(),
}));
vi.mock("@mantine/notifications", () => ({
  notifications: { show, update, hide },
}));
vi.mock("file-saver", () => ({ saveAs }));
vi.mock("@/i18n", () => ({
  default: {
    t: (key: string, opts?: { count: number }) =>
      key.replace("{{count}}", String(opts?.count)),
  },
}));

const task = {
  id: "zip-job",
  source: "confluence",
  fileName: "Guide.zip",
  metadata: { warnings: ["First page warning", "Second page warning"] },
} as unknown as IFileTask;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

it("shows completion from the uploader's warning data and downloads every message", async () => {
  notifyZipImportComplete(task);
  expect(hide).toHaveBeenCalledWith("import");
  const [notice] = show.mock.calls[0];
  expect(notice).toMatchObject({
    title: "Import complete with 2 warnings",
    autoClose: false,
  });
  render(<MantineProvider env="test">{notice.message}</MantineProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Download warnings" }));
  const [file, name] = saveAs.mock.calls[0];
  expect(name).toBe("Guide-warnings.txt");
  expect(file.type).toBe("text/plain;charset=utf-8");
  const text = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
  expect(text).toBe("First page warning\nSecond page warning\n");
});

it.each([
  { ...task, metadata: null },
  { ...task, metadata: { warnings: [] } },
  { ...task, source: "generic" },
])(
  "retains the regular success notice for an import without Confluence warnings",
  (clean) => {
    notifyZipImportComplete(clean);
    expect(show).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ color: "teal", title: "Import complete" }),
    );
  },
);
