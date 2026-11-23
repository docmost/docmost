import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useChatStream } from "../hooks/use-chat-stream";
import { sendChatMessage } from "../services/ai-chat-service";
import ChatToolGroup from "./chat-tool-group";

vi.mock("../services/ai-chat-service", () => ({ sendChatMessage: vi.fn() }));

describe("AI chat tool results", () => {
  it("shows the action while pending and distinguishes a stale edit from a confirmed edit", async () => {
    const i18n = createInstance();
    await i18n.init({ lng: "en", resources: { en: { translation: {} } } });
    const call = { id: "a", name: "edit_page", args: {} };
    const { rerender } = render(
      <ChatToolGroup toolCalls={[call]} isStreaming />,
      {
        wrapper: ({ children }) => (
          <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
        ),
      },
    );
    const pending = screen.getByRole("button").textContent;
    fireEvent.click(screen.getByRole("button"));
    rerender(
      <ChatToolGroup
        toolCalls={[
          { ...call, result: { error: "The page changed." } },
          { ...call, id: "b", result: { id: "page" } },
          { ...call, id: "c", result: {} },
        ]}
      />,
    );
    expect(screen.getByText("Edit page (failed)")).toBeTruthy();
    expect(screen.getByText("Edit page (unconfirmed)")).toBeTruthy();
    expect(screen.getAllByText("Edited page")).toHaveLength(1);
    expect(pending).toBe("Edit page…");
  });

  it("keeps partial text and confirmed tool results visible when the final reply fails", () => {
    vi.mocked(sendChatMessage).mockReturnValue(new AbortController());
    const client = new QueryClient();
    const { result } = renderHook(() => useChatStream("chat"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      ),
    });
    act(() => result.current.sendMessage("Edit the page"));
    const [, emit, , close] = vi.mocked(sendChatMessage).mock.calls[0];
    act(() => {
      emit({ type: "tool_call", id: "a", name: "edit_page", args: {} });
      emit({ type: "tool_result", id: "a", result: { id: "page" } });
      emit({ type: "content", text: "Page changes were confirmed." });
      emit({ type: "error", message: "Provider unavailable" });
      close();
    });
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBe("Provider unavailable");
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]).toMatchObject({
      content: "Page changes were confirmed.",
      toolCalls: [{ id: "a", result: { id: "page" } }],
    });
  });
});
