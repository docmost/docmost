import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { modals } from "@mantine/modals";
import type { ReactNode } from "react";
import type { ISpace } from "@/features/space/types/space.types";
import { useHasFeature } from "@/ee/hooks/use-feature";
import {
  getSpaceApprovalSettings,
  updateSpaceApprovalSettings,
} from "@/ee/page-verification/services/page-verification-service";
import type { ISpaceApprovalInfo } from "@/ee/page-verification/types/page-verification.types";
import SpaceApprovalSettings from "./space-approval-settings";

vi.mock("@/ee/hooks/use-feature", () => ({ useHasFeature: vi.fn() }));
vi.mock("@/ee/hooks/use-upgrade-label", () => ({
  useUpgradeLabel: () => "Upgrade your plan",
}));
vi.mock("@/ee/page-verification/services/page-verification-service", () => ({
  getSpaceApprovalSettings: vi.fn(),
  updateSpaceApprovalSettings: vi.fn(),
}));
vi.mock("@/features/page/queries/page-query", () => ({
  invalidatePageInfo: vi.fn(),
}));
vi.mock("@mantine/modals", () => ({
  modals: { openConfirmModal: vi.fn() },
}));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));
vi.mock("./verifier-picker", () => ({
  VerifierPicker: ({
    onSelect,
    disabled,
  }: {
    onSelect: (user: Record<string, string>) => void;
    disabled?: boolean;
  }) => (
    <button
      disabled={disabled}
      onClick={() =>
        onSelect({
          value: "u-9",
          label: "Grace",
          email: "grace@example.com",
          avatarUrl: "",
        })
      }
    >
      pick approver
    </button>
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? "")),
  }),
}));

const ada = { id: "u-1", name: "Ada", email: "ada@example.com", avatarUrl: null };
const linus = {
  id: "u-2",
  name: "Linus",
  email: "linus@example.com",
  avatarUrl: null,
};

const space = (approval?: Record<string, unknown>) =>
  ({ id: "space-1", settings: approval ? { approval } : {} }) as unknown as ISpace;

function renderSettings(
  current: ISpace,
  server: ISpaceApprovalInfo = { enabled: false, approvers: [] },
) {
  vi.mocked(getSpaceApprovalSettings).mockResolvedValue(server);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MantineProvider>
        <SpaceApprovalSettings space={current} />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

const toggle = () =>
  screen.getByRole("switch", {
    name: "Toggle approval for this space",
  }) as HTMLInputElement;

function confirmation() {
  const [config] = vi.mocked(modals.openConfirmModal).mock.calls.at(-1);
  return {
    config,
    render: () =>
      render(<MantineProvider>{config.children as ReactNode}</MantineProvider>),
  };
}

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  vi.mocked(useHasFeature).mockReturnValue(true);
  vi.mocked(getSpaceApprovalSettings).mockReset();
  vi.mocked(updateSpaceApprovalSettings)
    .mockReset()
    .mockResolvedValue({ enabled: true, approvers: [] });
  vi.mocked(modals.openConfirmModal).mockReset();
});

afterEach(cleanup);

describe("SpaceApprovalSettings turning approval on", () => {
  it("needs an approver before approval can be turned on", async () => {
    renderSettings(space());

    await screen.findByText("pick approver");
    expect(toggle().disabled).toBe(true);

    fireEvent.click(screen.getByText("pick approver"));

    expect(toggle().disabled).toBe(false);
    expect(screen.getByText("Grace")).toBeTruthy();
  });

  it("explains what turning it on does before it happens", async () => {
    renderSettings(space());
    await screen.findByText("pick approver");
    fireEvent.click(screen.getByText("pick approver"));

    fireEvent.click(toggle());

    expect(updateSpaceApprovalSettings).not.toHaveBeenCalled();
    const { config, render: renderBody } = confirmation();
    expect(config.title).toBe("Require approval for this space");
    renderBody();
    expect(
      screen.getByText(
        "Current content of every page becomes the starting version readers see.",
      ),
    ).toBeTruthy();
  });

  it("turns approval on with the chosen approvers once confirmed", async () => {
    renderSettings(space());
    await screen.findByText("pick approver");
    fireEvent.click(screen.getByText("pick approver"));
    fireEvent.click(toggle());

    confirmation().config.onConfirm();

    await waitFor(() =>
      expect(updateSpaceApprovalSettings).toHaveBeenCalledWith({
        spaceId: "space-1",
        enabled: true,
        approverIds: ["u-9"],
      }),
    );
  });

  it("cannot be turned on without the licence", async () => {
    vi.mocked(useHasFeature).mockReturnValue(false);
    renderSettings(space());

    expect(toggle().disabled).toBe(true);
    expect(screen.queryByText("pick approver")).toBeNull();
    expect(getSpaceApprovalSettings).not.toHaveBeenCalled();
  });
});

describe("SpaceApprovalSettings while approval is on", () => {
  const enabled = { enabled: true, approvers: [ada, linus] };

  it("lists the approvers the server has", async () => {
    renderSettings(space({ enabled: true, approverIds: ["u-1", "u-2"] }), enabled);

    expect(await screen.findByText("Ada")).toBeTruthy();
    expect(screen.getByText("Linus")).toBeTruthy();
    expect(toggle().checked).toBe(true);
  });

  it("saves an added approver right away", async () => {
    renderSettings(space({ enabled: true, approverIds: ["u-1", "u-2"] }), enabled);
    await screen.findByText("Ada");

    fireEvent.click(screen.getByText("pick approver"));

    await waitFor(() =>
      expect(updateSpaceApprovalSettings).toHaveBeenCalledWith({
        spaceId: "space-1",
        enabled: true,
        approverIds: ["u-1", "u-2", "u-9"],
      }),
    );
  });

  it("saves a removed approver right away", async () => {
    renderSettings(space({ enabled: true, approverIds: ["u-1", "u-2"] }), enabled);
    await screen.findByText("Ada");

    fireEvent.click(screen.getByRole("button", { name: "Remove Ada" }));

    await waitFor(() =>
      expect(updateSpaceApprovalSettings).toHaveBeenCalledWith({
        spaceId: "space-1",
        enabled: true,
        approverIds: ["u-2"],
      }),
    );
  });

  it("keeps the last approver", async () => {
    renderSettings(space({ enabled: true, approverIds: ["u-1"] }), {
      enabled: true,
      approvers: [ada],
    });
    await screen.findByText("Ada");

    expect(screen.queryByRole("button", { name: "Remove Ada" })).toBeNull();
    expect(
      screen.getByText("At least one approver is required while approval is on."),
    ).toBeTruthy();
  });

  it("publishes every draft when it is turned off", async () => {
    renderSettings(space({ enabled: true, approverIds: ["u-1", "u-2"] }), enabled);
    await screen.findByText("Ada");

    fireEvent.click(toggle());

    const { config, render: renderBody } = confirmation();
    expect(config.title).toBe("Turn off approval for this space");
    renderBody();
    expect(
      screen.getByText("Every draft in this space is published as it is."),
    ).toBeTruthy();

    config.onConfirm();
    await waitFor(() =>
      expect(updateSpaceApprovalSettings).toHaveBeenCalledWith({
        spaceId: "space-1",
        enabled: false,
      }),
    );
  });

  it("can still be turned off when the licence has lapsed", async () => {
    vi.mocked(useHasFeature).mockReturnValue(false);
    renderSettings(space({ enabled: true, approverIds: ["u-1"] }));

    expect(toggle().checked).toBe(true);
    expect(toggle().disabled).toBe(false);
    expect(screen.queryByText("pick approver")).toBeNull();

    fireEvent.click(toggle());
    confirmation().config.onConfirm();

    await waitFor(() =>
      expect(updateSpaceApprovalSettings).toHaveBeenCalledWith({
        spaceId: "space-1",
        enabled: false,
      }),
    );
  });

  it("keeps the picker off until the approvers are loaded so a quick pick cannot replace them", async () => {
    let resolveSettings: (info: ISpaceApprovalInfo) => void = () => undefined;
    vi.mocked(getSpaceApprovalSettings).mockReturnValue(
      new Promise((resolve) => {
        resolveSettings = resolve;
      }),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MantineProvider>
          <SpaceApprovalSettings
            space={space({ enabled: true, approverIds: ["u-1", "u-2"] })}
          />
        </MantineProvider>
      </QueryClientProvider>,
    );

    const picker = screen.getByText("pick approver") as HTMLButtonElement;
    expect(picker.disabled).toBe(true);
    fireEvent.click(picker);
    expect(updateSpaceApprovalSettings).not.toHaveBeenCalled();

    resolveSettings(enabled);
    await screen.findByText("Ada");
    expect(
      (screen.getByText("pick approver") as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("leaves the approvers alone while a turn-off is unfinished", async () => {
    renderSettings(
      space({ enabled: true, disabling: true, approverIds: ["u-1", "u-2"] }),
      enabled,
    );
    await screen.findByText("Ada");

    expect(
      (screen.getByText("pick approver") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Remove Ada" })).toBeNull();
    expect(toggle().checked).toBe(true);
    expect(toggle().disabled).toBe(false);
  });

  it("lets a disable that stopped halfway be run again", () => {
    vi.mocked(useHasFeature).mockReturnValue(false);
    renderSettings(
      space({ enabled: false, disabling: true, approverIds: ["u-1"] }),
    );

    expect(toggle().checked).toBe(true);
    expect(
      screen.getByText(
        "Turning off approval did not finish. Turn it off again to publish the remaining drafts.",
      ),
    ).toBeTruthy();
  });
});
