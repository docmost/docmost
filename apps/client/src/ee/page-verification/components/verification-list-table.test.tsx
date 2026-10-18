import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";
import type {
  IVerificationListItem,
  VerificationStatus,
} from "@/ee/page-verification/types/page-verification.types";
import VerificationListTable from "./verification-list-table";

vi.mock("@/components/ui/custom-avatar", () => ({
  CustomAvatar: () => null,
}));
vi.mock("@/lib/date-locale.ts", () => ({
  useDateFnsLocale: () => ({}),
  formatLocalized: () => "Oct 12, 2026",
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const item = (status: VerificationStatus): IVerificationListItem => ({
  id: "v-1",
  pageId: "page-1",
  spaceId: "space-1",
  type: "qms",
  status,
  mode: null,
  periodAmount: null,
  periodUnit: null,
  verifiedAt: null,
  expiresAt: null,
  createdAt: "2026-10-12T09:00:00Z",
  pageTitle: "Torque spec",
  pageSlugId: "slug-1",
  pageIcon: null,
  spaceName: "Quality",
  spaceSlug: "quality",
  verifiers: [],
});

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
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

describe("VerificationListTable status", () => {
  it("labels content that was never approved so the status is not blank", () => {
    render(
      <MantineProvider>
        <MemoryRouter>
          <VerificationListTable items={[item("not_approved")]} isLoading={false} />
        </MemoryRouter>
      </MantineProvider>,
    );

    expect(screen.getByText("Not yet approved")).toBeTruthy();
  });
});
