import type { ReactNode } from "react";
import { AxiosError } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { htmlBlockQueryKey, useHtmlBlockContent } from "./html-block-query";
import { HtmlBlockScopeProvider } from "../html-block-scope";
import * as service from "../services/html-block-service";
import type { HtmlBlockScope, IHtmlBlock } from "../types/html-block.types";

vi.mock("../services/html-block-service");

const block = (content: string): IHtmlBlock => ({
  id: "b1",
  pageId: "p1",
  templateId: null,
  content,
  createdAt: "2026-11-21T09:00:00.000Z",
});

const requestError = (status: number, message: string) =>
  new AxiosError(
    `Request failed with status code ${status}`,
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    {
      status,
      data: { message },
      statusText: "",
      headers: {},
      config: {} as never,
    },
  );

function setup(htmlBlockId: string | null, scope: HtmlBlockScope = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <HtmlBlockScopeProvider {...scope}>{children}</HtmlBlockScopeProvider>
    </QueryClientProvider>
  );
  return {
    queryClient,
    ...renderHook(() => useHtmlBlockContent(htmlBlockId), { wrapper }),
  };
}

const expectNoServiceCalls = () => {
  expect(service.getHtmlBlock).not.toHaveBeenCalled();
  expect(service.getSharedHtmlBlock).not.toHaveBeenCalled();
  expect(service.getPublicSpaceHtmlBlock).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useHtmlBlockContent", () => {
  it("loads the content for a signed-in viewer", async () => {
    vi.mocked(service.getHtmlBlock).mockResolvedValue(block("<p>Hi</p>"));

    const { result, queryClient } = setup("b1");

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.content).toBe("<p>Hi</p>"));
    expect(result.current).toEqual({
      content: "<p>Hi</p>",
      isLoading: false,
      error: null,
    });
    expect(service.getHtmlBlock).toHaveBeenCalledWith("b1");
    expect(queryClient.getQueryData(htmlBlockQueryKey("b1"))).toEqual(
      block("<p>Hi</p>"),
    );
  });

  it("reports a workspace with HTML blocks turned off as disabled", async () => {
    vi.mocked(service.getHtmlBlock).mockRejectedValue(
      requestError(403, "HTML blocks are disabled in this workspace"),
    );

    const { result } = setup("b1");

    await waitFor(() => expect(result.current.error).toBe("disabled"));
    expect(result.current.content).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(service.getHtmlBlock).toHaveBeenCalledTimes(1);
  });

  it("reports a missing block as unavailable", async () => {
    vi.mocked(service.getHtmlBlock).mockRejectedValue(
      requestError(404, "HTML block not found"),
    );

    const { result } = setup("b1");

    await waitFor(() => expect(result.current.error).toBe("unavailable"));
    expect(result.current.content).toBeUndefined();
  });

  it("reports another refusal as unavailable", async () => {
    vi.mocked(service.getHtmlBlock).mockRejectedValue(
      requestError(403, "Forbidden"),
    );

    const { result } = setup("b1");

    await waitFor(() => expect(result.current.error).toBe("unavailable"));
  });

  it("uses preloaded content without asking the server", () => {
    const { result } = setup("b1", { preloaded: { b1: "<p>For the PDF</p>" } });

    expect(result.current).toEqual({
      content: "<p>For the PDF</p>",
      isLoading: false,
      error: null,
    });
    expectNoServiceCalls();
  });

  it("reports a block missing from the preloaded content as unavailable", () => {
    const { result } = setup("b2", { preloaded: { b1: "<p>For the PDF</p>" } });

    expect(result.current).toEqual({
      content: undefined,
      isLoading: false,
      error: "unavailable",
    });
    expectNoServiceCalls();
  });

  it("reads through the share on a shared page", async () => {
    vi.mocked(service.getSharedHtmlBlock).mockResolvedValue(block("<p>Shared</p>"));

    const { result, queryClient } = setup("b1", { shareId: "s1" });

    await waitFor(() => expect(result.current.content).toBe("<p>Shared</p>"));
    expect(service.getSharedHtmlBlock).toHaveBeenCalledWith({
      shareId: "s1",
      htmlBlockId: "b1",
    });
    expect(service.getHtmlBlock).not.toHaveBeenCalled();
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: htmlBlockQueryKey("b1"), exact: true }),
    ).toBeUndefined();
  });

  it("reads through the published space in a public space", async () => {
    vi.mocked(service.getPublicSpaceHtmlBlock).mockResolvedValue(
      block("<p>Published</p>"),
    );

    const { result, queryClient } = setup("b1", { spaceSlug: "handbook" });

    await waitFor(() => expect(result.current.content).toBe("<p>Published</p>"));
    expect(service.getPublicSpaceHtmlBlock).toHaveBeenCalledWith({
      spaceSlug: "handbook",
      htmlBlockId: "b1",
    });
    expect(service.getHtmlBlock).not.toHaveBeenCalled();
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: htmlBlockQueryKey("b1"), exact: true }),
    ).toBeUndefined();
  });

  it("does nothing for a block that has no saved version yet", () => {
    const { result } = setup(null);

    expect(result.current).toEqual({
      content: undefined,
      isLoading: false,
      error: null,
    });
    expectNoServiceCalls();
  });
});
