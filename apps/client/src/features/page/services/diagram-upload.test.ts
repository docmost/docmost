import { afterEach, expect, it, vi } from "vitest";
import api from "@/lib/api-client";
import { uploadFile } from "./page-service";

vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn() } }));

const post = vi.mocked(api.post);
const file = new File(["<svg/>"], "diagram.drawio.svg", {
  type: "image/svg+xml",
});
const target = { pageId: "page-1" };
const options = { type: "drawio", attachmentId: "original" } as const;
const failure = (status: number, code?: string) => ({
  isAxiosError: true,
  response: { status, data: { code } },
});

afterEach(() => post.mockReset());

it("saves an untyped legacy diagram under a new ID and reuses that ID on the next edit", async () => {
  const copy = { id: "copy" };
  post
    .mockRejectedValueOnce(failure(409, "ATTACHMENT_NOT_DIAGRAM"))
    .mockResolvedValue(copy);
  const saved = await uploadFile(file, target, options);
  await uploadFile(file, target, { ...options, attachmentId: saved.id });

  const forms = post.mock.calls.map(([, body]) => body as FormData);
  expect(forms.map((form) => form.get("attachmentId"))).toEqual([
    "original",
    null,
    "copy",
  ]);
  for (const form of forms) {
    expect(form.get("type")).toBe("drawio");
    expect(form.get("pageId")).toBe(target.pageId);
    expect(form.get("file")).toBe(file);
  }
});

it.each([
  failure(400),
  failure(403),
  failure(409, "OTHER"),
  new Error("offline"),
])("propagates other save failures without creating a file", async (error) => {
  post.mockRejectedValue(error);
  await expect(uploadFile(file, target, options)).rejects.toBe(error);
  expect(post).toHaveBeenCalledTimes(1);
});
