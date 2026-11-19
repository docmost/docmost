import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { getUserProfile } from "@/features/user/services/user-service";
import { UserMention } from "@/features/editor/components/mention/user-mention";
import { UserHoverCard } from "./user-hover-card";
import { UserProfilePopover } from "./user-profile-popover";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (value: string, options?: { time?: string }) =>
      value.replace("{{time}}", options?.time ?? ""),
    i18n: { language: "en-US" },
  }),
}));

vi.mock("@/i18n.ts", () => ({
  default: { language: "en-US", t: (value: string) => value },
}));

vi.mock("@/features/user/services/user-service", () => ({
  getUserProfile: vi.fn(),
}));

const USER_ID = "0190c3c5-8b7d-7c3e-9a53-6f3f2a1b4c5d";

const profile = {
  id: USER_ID,
  name: "Ada Lovelace",
  avatarUrl: "",
  email: "ada@example.com",
  role: "member",
  deactivatedAt: null,
  deletedAt: null,
};

function setMediaMatch() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderWithProviders(ui: React.ReactElement, path = "/s/docs/p/page") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = createStore();
  store.set(currentUserAtom, { user: { id: "viewer" } } as any);

  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
        </Provider>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("UserHoverCard", () => {
  beforeEach(() => {
    setMediaMatch();
    vi.mocked(getUserProfile).mockReset();
  });
  afterEach(() => {
    cleanup();
  });

  it("does not fetch until opened", () => {
    vi.mocked(getUserProfile).mockResolvedValue(profile as any);

    renderWithProviders(
      <UserHoverCard userId={USER_ID}>
        <span>@Ada</span>
      </UserHoverCard>,
    );

    expect(getUserProfile).not.toHaveBeenCalled();
  });

  it("shows the profile after hover", async () => {
    vi.mocked(getUserProfile).mockResolvedValue(profile as any);

    renderWithProviders(
      <UserHoverCard userId={USER_ID}>
        <span>@Ada</span>
      </UserHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByText("@Ada"));

    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    const link = (await screen.findByText("View profile")).closest("a");
    expect(link?.getAttribute("href")).toBe(`/people/${USER_ID}`);
    expect(getUserProfile).toHaveBeenCalledWith(USER_ID);
  });

  it("shows a status badge for a deactivated member", async () => {
    vi.mocked(getUserProfile).mockResolvedValue({
      ...profile,
      deactivatedAt: "2026-02-01T00:00:00.000Z",
    } as any);

    renderWithProviders(
      <UserHoverCard userId={USER_ID}>
        <span>@Ada</span>
      </UserHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByText("@Ada"));

    expect(await screen.findByText("Deactivated")).toBeTruthy();
  });

  it("shows unavailable on 404", async () => {
    vi.mocked(getUserProfile).mockRejectedValue({ response: { status: 404 } });

    renderWithProviders(
      <UserHoverCard userId={USER_ID}>
        <span>@Ada</span>
      </UserHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByText("@Ada"));

    expect(await screen.findByText("Profile unavailable")).toBeTruthy();
  });
});

describe("UserMention", () => {
  beforeEach(() => {
    setMediaMatch();
    vi.mocked(getUserProfile).mockReset();
    vi.mocked(getUserProfile).mockResolvedValue(profile as any);
  });
  afterEach(() => {
    cleanup();
  });

  it("opens the profile card on a page route", async () => {
    renderWithProviders(<UserMention label="Ada" entityId={USER_ID} />);

    fireEvent.mouseEnter(screen.getByText("@Ada"));

    await waitFor(() => expect(getUserProfile).toHaveBeenCalledWith(USER_ID));
  });

  it("shows the current name of an active member", async () => {
    renderWithProviders(<UserMention label="Ada" entityId={USER_ID} />);

    expect(screen.getByText("@Ada")).toBeTruthy();
    expect(await screen.findByText("@Ada Lovelace")).toBeTruthy();
  });

  it.each([
    ["a deactivated member", { deactivatedAt: "2026-02-01T00:00:00.000Z" }],
    ["a deleted member", { deletedAt: "2026-02-01T00:00:00.000Z" }],
  ])("keeps the saved name for %s", async (_name, status) => {
    vi.mocked(getUserProfile).mockResolvedValue({
      ...profile,
      ...status,
    } as any);

    renderWithProviders(<UserMention label="Ada" entityId={USER_ID} />);

    await waitFor(() => expect(getUserProfile).toHaveBeenCalledWith(USER_ID));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText("@Ada")).toBeTruthy();
    expect(screen.queryByText("@Ada Lovelace")).toBeNull();
  });

  it("keeps the saved name when the profile can't be loaded", async () => {
    vi.mocked(getUserProfile).mockRejectedValue({ response: { status: 404 } });

    renderWithProviders(<UserMention label="Ada" entityId={USER_ID} />);

    await waitFor(() => expect(getUserProfile).toHaveBeenCalledWith(USER_ID));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText("@Ada")).toBeTruthy();
  });

  it.each([
    ["share routes", "/share/abc/p/x", USER_ID],
    ["public space routes", "/docs/space/p/x", USER_ID],
    ["a non-UUID id", "/s/docs/p/page", "not-a-uuid"],
  ])("renders a plain mention on %s", async (_name, path, entityId) => {
    renderWithProviders(<UserMention label="Ada" entityId={entityId} />, path);

    fireEvent.mouseEnter(screen.getByText("@Ada"));
    await new Promise((resolve) => setTimeout(resolve, 450));

    expect(screen.getByText("@Ada")).toBeTruthy();
    expect(getUserProfile).not.toHaveBeenCalled();
  });

  it("renders a plain mention without a signed-in user", async () => {
    const queryClient = new QueryClient();
    const store = createStore();
    store.set(currentUserAtom, null);

    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <Provider store={store}>
            <MemoryRouter initialEntries={["/s/docs/p/page"]}>
              <UserMention label="Ada" entityId={USER_ID} />
            </MemoryRouter>
          </Provider>
        </QueryClientProvider>
      </MantineProvider>,
    );

    fireEvent.mouseEnter(screen.getByText("@Ada"));
    await new Promise((resolve) => setTimeout(resolve, 450));

    expect(getUserProfile).not.toHaveBeenCalled();
  });
});

describe("UserProfilePopover", () => {
  beforeEach(() => {
    setMediaMatch();
    vi.mocked(getUserProfile).mockReset();
    vi.mocked(getUserProfile).mockResolvedValue(profile as any);
  });
  afterEach(() => {
    cleanup();
  });

  it("opens the profile card on click, not on hover", async () => {
    renderWithProviders(
      <UserProfilePopover userId={USER_ID}>
        <button type="button">Ada</button>
      </UserProfilePopover>,
    );

    fireEvent.mouseEnter(screen.getByText("Ada"));
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(getUserProfile).not.toHaveBeenCalled();
    expect(screen.queryByText("View profile")).toBeNull();

    fireEvent.click(screen.getByText("Ada"));

    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    const link = (await screen.findByText("View profile")).closest("a");
    expect(link?.getAttribute("href")).toBe(`/people/${USER_ID}`);
  });
});
