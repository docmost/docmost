import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLegalHoldExportsQuery } from "./legal-hold-query";
import * as service from "../services/legal-hold-service";
import type {
  LegalHoldExportStatus,
  LegalHoldExportView,
} from "../types/legal-hold.types";

vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../services/legal-hold-service");

const exportView = (status: LegalHoldExportStatus): LegalHoldExportView => ({
  id: "e1",
  legalHoldId: "h1",
  status,
  fileName: "contract-dispute-legal-hold-2026-11-12.zip",
  fileSize: status === "success" ? 2048 : null,
  errorMessage: null,
  creator: null,
  createdAt: "2026-11-12T10:00:00.000Z",
  updatedAt: "2026-11-12T10:00:00.000Z",
  expiresAt: status === "success" ? "2026-11-19T10:00:00.000Z" : null,
});

function setup() {
  // the app's defaults from main.tsx
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 5 * 60 * 1000,
      },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useLegalHoldExportsQuery("h1").data, { wrapper });
}

const flush = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
});

afterEach(() => vi.useRealTimers());

describe("useLegalHoldExportsQuery", () => {
  it("polls every 3 seconds while an export is processing and stops once it is ready", async () => {
    vi.mocked(service.getLegalHoldExports)
      .mockResolvedValueOnce([exportView("processing")])
      .mockResolvedValue([exportView("success")]);
    const { result } = setup();
    await flush();
    expect(service.getLegalHoldExports).toHaveBeenCalledTimes(1);

    await flush(2_999);
    expect(service.getLegalHoldExports).toHaveBeenCalledTimes(1);

    await flush(1);
    expect(service.getLegalHoldExports).toHaveBeenCalledTimes(2);
    // let the response land and the batched render run
    await flush(100);
    expect(result.current?.[0].status).toBe("success");

    await flush(30_000);
    expect(service.getLegalHoldExports).toHaveBeenCalledTimes(2);
  });

  it("does not poll when no export is processing", async () => {
    vi.mocked(service.getLegalHoldExports).mockResolvedValue([
      exportView("failed"),
      exportView("expired"),
    ]);
    setup();
    await flush();
    await flush(30_000);
    expect(service.getLegalHoldExports).toHaveBeenCalledTimes(1);
  });
});
