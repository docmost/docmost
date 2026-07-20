import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { MantineProvider } from "@mantine/core";
import { ReviewActionBar } from "../review-action-bar";
import { IReviewDecisionEntry } from "@/ee/page-verification/types/page-verification.types";

const approveMutate = vi.fn();
const rejectMutate = vi.fn();
const clarifyMutate = vi.fn();

vi.mock("@/ee/page-verification/queries/page-verification-query", () => ({
  useApproveReviewMutation: () => ({
    mutate: approveMutate,
    isPending: false,
  }),
  useRejectReviewMutation: () => ({
    mutate: rejectMutate,
    isPending: false,
  }),
  useRequestClarificationMutation: () => ({
    mutate: clarifyMutate,
    isPending: false,
  }),
}));

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: "en",
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe("ReviewActionBar", () => {
  beforeEach(() => {
    approveMutate.mockClear();
    rejectMutate.mockClear();
    clarifyMutate.mockClear();
  });

  it("enables Approve/Reject and disables Need Clarify when there are no unresolved comments", () => {
    renderWithProviders(
      <ReviewActionBar
        pageId="page-1"
        unresolvedCommentCount={0}
        myReview={undefined}
      />,
    );

    expect(
      (screen.getByRole("button", { name: /Approve/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (screen.getByRole("button", { name: /Reject/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (
        screen.getByRole("button", {
          name: /Need Clarify/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("disables Approve/Reject and enables Need Clarify when there are unresolved comments", () => {
    renderWithProviders(
      <ReviewActionBar
        pageId="page-1"
        unresolvedCommentCount={2}
        myReview={undefined}
      />,
    );

    expect(
      (screen.getByRole("button", { name: /Approve/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: /Reject/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: /Need Clarify/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("shows the decision label instead of buttons when the current user already decided", () => {
    const myReview: IReviewDecisionEntry = {
      id: "r1",
      decision: "approved",
      decidedAt: new Date().toISOString(),
      verifierId: "user-1",
      verifierName: "John Doe",
      verifierAvatarUrl: null,
    };

    renderWithProviders(
      <ReviewActionBar
        pageId="page-1"
        unresolvedCommentCount={0}
        myReview={myReview}
      />,
    );

    expect(
      screen.getByText(/You already responded to this review/i),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Approve/i }),
    ).toBeNull();
  });

  it("shows action buttons when the current user's review is still pending", () => {
    const myReview: IReviewDecisionEntry = {
      id: "r1",
      decision: "pending",
      decidedAt: null,
      verifierId: "user-1",
      verifierName: "John Doe",
      verifierAvatarUrl: null,
    };

    renderWithProviders(
      <ReviewActionBar
        pageId="page-1"
        unresolvedCommentCount={0}
        myReview={myReview}
      />,
    );

    expect(screen.getByRole("button", { name: /Approve/i })).toBeTruthy();
  });
});
