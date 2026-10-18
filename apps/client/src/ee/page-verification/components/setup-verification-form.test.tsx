import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getDefaultStore } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { usePageQuery } from "@/features/page/queries/page-query";
import type { IPage } from "@/features/page/types/page.types";
import { setupVerification } from "@/ee/page-verification/services/page-verification-service";
import { usePageVerificationInfoQuery } from "@/ee/page-verification/queries/page-verification-query";
import { SetupVerificationForm } from "./setup-verification-form";

vi.mock("@/ee/page-verification/services/page-verification-service", () => ({
  setupVerification: vi.fn(),
}));
vi.mock("@/features/page/queries/page-query", () => ({
  usePageQuery: vi.fn(),
  invalidatePageInfo: vi.fn(),
}));
vi.mock(
  "@/ee/page-verification/queries/page-verification-query",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/ee/page-verification/queries/page-verification-query")
    >()),
    usePageVerificationInfoQuery: vi.fn(),
  }),
);
vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));
vi.mock("@/components/ui/custom-avatar", () => ({ CustomAvatar: () => null }));
vi.mock("./expiration-fields", () => ({
  ExpirationFields: () => <div data-testid="expiration" />,
  PERIOD_AMOUNT_MIN: 1,
  PERIOD_UNIT_MAX_AMOUNT: { day: 3650, week: 520, month: 120, year: 20 },
}));
vi.mock("./verifier-picker", () => ({
  VerifierPicker: ({
    onSelect,
    placeholder,
  }: {
    onSelect: (user: Record<string, string>) => void;
    placeholder?: string;
  }) => (
    <button
      onClick={() =>
        onSelect({
          value: "u-9",
          label: "Grace",
          email: "grace@example.com",
          avatarUrl: "",
        })
      }
    >
      {placeholder ?? "pick verifier"}
    </button>
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? "")),
  }),
}));

const onClose = vi.fn();

function renderForm() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MantineProvider>
        <SetupVerificationForm pageId="page-1" onClose={onClose} />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

function mockPage(page: Partial<IPage> = {}) {
  vi.mocked(usePageQuery).mockReturnValue({
    data: {
      id: "page-1",
      isBase: false,
      approval: { controlled: false, canAccessDraft: true, unpublished: false },
      ...page,
    },
  } as unknown as ReturnType<typeof usePageQuery>);
}

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const setUpButton = () => button("Set up") as HTMLButtonElement;

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
  onClose.mockReset();
  vi.mocked(setupVerification).mockReset().mockResolvedValue();
  vi.mocked(usePageVerificationInfoQuery).mockReturnValue({
    data: { status: "none" },
  } as ReturnType<typeof usePageVerificationInfoQuery>);
  mockPage();
  getDefaultStore().set(currentUserAtom, {
    user: { id: "u-me", name: "Me", email: "me@example.com", avatarUrl: "" },
    workspace: {},
  } as never);
});

afterEach(() => {
  cleanup();
  getDefaultStore().set(currentUserAtom, null);
});

describe("SetupVerificationForm", () => {
  it("starts with the choice between recurring verification and the approval workflow", () => {
    renderForm();

    expect(button(/Recurring verification/)).toBeTruthy();
    expect(button(/Approval workflow/)).toBeTruthy();
  });

  it("verifies a page on a schedule once the current user confirmed", async () => {
    renderForm();
    fireEvent.click(button(/Recurring verification/));

    expect(screen.getByText("Me")).toBeTruthy();
    expect((button("Verify") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("I've reviewed this page for accuracy"));
    fireEvent.click(button("Verify"));

    await waitFor(() => expect(setupVerification).toHaveBeenCalledTimes(1));
    expect(setupVerification).toHaveBeenCalledWith({
      pageId: "page-1",
      type: "expiring",
      mode: "period",
      periodAmount: 1,
      periodUnit: "month",
      verifierIds: ["u-me"],
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("sets the approval workflow up with the approvers and leaves the dialog open for the next step", async () => {
    renderForm();
    fireEvent.click(button(/Approval workflow/));

    expect(screen.getByText("Approvers")).toBeTruthy();
    expect(screen.getByText("Me")).toBeTruthy();

    fireEvent.click(button("Add approver"));
    fireEvent.click(setUpButton());

    await waitFor(() => expect(setupVerification).toHaveBeenCalledTimes(1));
    expect(setupVerification).toHaveBeenCalledWith({
      pageId: "page-1",
      type: "qms",
      verifierIds: ["u-me", "u-9"],
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("needs an approver for the approval workflow", () => {
    renderForm();
    fireEvent.click(button(/Approval workflow/));
    expect(setUpButton().disabled).toBe(false);

    fireEvent.click(button("Remove Me"));

    expect(setUpButton().disabled).toBe(true);
  });

  it("goes back to the choice", () => {
    renderForm();
    fireEvent.click(button(/Approval workflow/));

    fireEvent.click(button("Back"));

    expect(button(/Recurring verification/)).toBeTruthy();
  });

  it("still offers recurring verification for a page that approval does not control in an approval space", () => {
    // Bases are never approved, whatever their space requires, so the form must not decide from the space.
    vi.mocked(usePageVerificationInfoQuery).mockReturnValue({
      data: { status: "none", spaceRequiresApproval: true },
    } as ReturnType<typeof usePageVerificationInfoQuery>);
    mockPage({ isBase: true });
    renderForm();

    expect(button(/Recurring verification/)).toBeTruthy();
    expect(button(/Approval workflow/)).toBeTruthy();
  });
});
