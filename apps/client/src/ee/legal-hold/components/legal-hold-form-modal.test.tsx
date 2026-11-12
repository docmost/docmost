import { MantineProvider } from "@mantine/core";
import { AxiosError } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LegalHoldFormModal } from "./legal-hold-form-modal";
import * as service from "../services/legal-hold-service";
import type {
  LegalHoldDetail,
  LegalHoldSpaceView,
  LegalHoldUserView,
} from "../types/legal-hold.types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("../services/legal-hold-service");

const user: LegalHoldUserView = {
  id: "0195f7a2-0000-7000-8000-000000000001",
  name: "Ada Lovelace",
  email: "ada@example.com",
  avatarUrl: null,
  deactivatedAt: null,
  deletedAt: null,
};

const space: LegalHoldSpaceView = {
  id: "0195f7a2-0000-7000-8000-000000000002",
  name: "Engineering",
  slug: "engineering",
  logo: null,
  archivedAt: null,
  deleted: false,
};

const legalHold: LegalHoldDetail = {
  id: "0195f7a2-0000-7000-8000-000000000003",
  name: "Contract dispute",
  description: "Case 42",
  status: "active",
  custodianCount: 1,
  spaceCount: 1,
  custodians: [user],
  spaces: [space],
  creator: null,
  releasedBy: null,
  createdAt: "2026-11-12T10:00:00.000Z",
  updatedAt: "2026-11-12T10:00:00.000Z",
  releasedAt: null,
  preservedItemCount: 0,
  pagesInScopeCount: 3,
};

const page = <T,>(items: T[]) => ({
  items,
  meta: {
    limit: 50,
    hasNextPage: false,
    hasPrevPage: false,
    nextCursor: null,
    prevCursor: null,
  },
});

function renderModal(legalHoldId: string | null) {
  const onClose = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider env="test">
        <LegalHoldFormModal
          opened
          onClose={onClose}
          legalHoldId={legalHoldId}
        />
      </MantineProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

const typeName = (text: string) =>
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
    target: { value: text },
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(service.searchLegalHoldUsers).mockResolvedValue(page([user]));
  vi.mocked(service.searchLegalHoldSpaces).mockResolvedValue(page([space]));
  vi.mocked(service.getLegalHold).mockResolvedValue(legalHold);
  Element.prototype.scrollIntoView = () => {};
  // jsdom has no FontFaceSet, which the autosize Textarea listens to
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LegalHoldFormModal", () => {
  it("asks for a name and a custodian or space before creating", async () => {
    renderModal(null);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Name is required")).toBeTruthy();
    expect(screen.getByText("Add at least one custodian or space")).toBeTruthy();
    expect(service.createLegalHold).not.toHaveBeenCalled();
  });

  it("creates a hold with a trimmed name and one space", async () => {
    vi.mocked(service.createLegalHold).mockResolvedValue(legalHold);
    const { onClose } = renderModal(null);
    // the modal moves focus to the name field, which would close a dropdown opened first
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("textbox", { name: "Name" }),
      ),
    );
    typeName("  Contract dispute  ");
    fireEvent.click(screen.getByRole("combobox", { name: "Spaces" }));
    fireEvent.click(await screen.findByRole("option", { name: "Engineering" }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(service.createLegalHold).mock.calls[0][0]).toEqual({
      name: "Contract dispute",
      description: "",
      userIds: [],
      spaceIds: [space.id],
    });
  });

  it("shows the hold's custodians and spaces by name when editing", async () => {
    renderModal(legalHold.id);

    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Engineering")).toBeTruthy();
    expect(screen.queryByText(user.id)).toBeNull();
    expect(screen.queryByText(space.id)).toBeNull();
  });

  it("leaves unchanged custodians and spaces out of an update", async () => {
    vi.mocked(service.updateLegalHold).mockResolvedValue(legalHold);
    const { onClose } = renderModal(legalHold.id);
    await screen.findByText("Ada Lovelace");
    typeName("Contract dispute 2026");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(service.updateLegalHold).mock.calls[0][0]).toEqual({
      legalHoldId: legalHold.id,
      name: "Contract dispute 2026",
      description: "Case 42",
    });
  });

  it("keeps the form open and shows the server error", async () => {
    vi.mocked(service.updateLegalHold).mockRejectedValue(
      new AxiosError(
        "Request failed with status code 400",
        "ERR_BAD_REQUEST",
        undefined,
        undefined,
        {
          status: 400,
          data: { message: "This legal hold has been released" },
          statusText: "",
          headers: {},
          config: {} as never,
        },
      ),
    );
    const { onClose } = renderModal(legalHold.id);
    await screen.findByText("Ada Lovelace");
    typeName("Renamed");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("This legal hold has been released"),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
