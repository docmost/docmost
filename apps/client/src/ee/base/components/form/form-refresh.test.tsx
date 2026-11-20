import { createRequire } from "node:module";
import { MantineProvider } from "@mantine/core";
import {
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type {} from "@testing-library/jest-dom/vitest";
import { HelmetProvider } from "react-helmet-async";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Avoid bootstrapping the application, but keep its cache defaults so these
// tests exercise the public form's overrides of the application's policy.
vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient({
    defaultOptions: {
      queries: {
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 5 * 60 * 1000,
      },
    },
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
    i18n: { language: "en-US" },
  }),
}));

const transport = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ default: transport }));

import { queryClient } from "@/main.tsx";
import PublicFormPage from "@/ee/base/pages/public-form-page";
import type {
  IBaseView,
  PublicForm,
  PublicFormField,
  PublicFormResponse,
  SubmitPublicFormInput,
} from "@/ee/base/types/base.types";
import { FormRespond } from "./form-respond";

expect.extend(
  createRequire(import.meta.url)("@testing-library/jest-dom/matchers"),
);

const nameField: PublicFormField = {
  propertyId: "name",
  type: "text",
  label: "Name",
  description: null,
  required: false,
  defaultValue: null,
};
const emailField: PublicFormField = {
  propertyId: "email",
  type: "email",
  label: "Work email",
  description: null,
  required: true,
  defaultValue: null,
};

function openForm(overrides: Partial<PublicForm> = {}): PublicFormResponse {
  return {
    status: "open",
    form: {
      title: "Event registration",
      description: null,
      submitLabel: null,
      successTitle: null,
      successMessage: null,
      allowResubmit: false,
      access: "public",
      fields: [nameField],
      ...overrides,
    },
    respondent: null,
    users: {},
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  // A failing cache policy may never consume this controlled response.
  void promise.catch(() => {});
  return { promise, resolve, reject };
}

function httpError(status: number) {
  return {
    isAxiosError: true,
    response: { status, data: { message: "Form unavailable" } },
  };
}

let response: PublicFormResponse | Promise<PublicFormResponse>;
let requestedKeys: string[];
let requestSignals: (AbortSignal | undefined)[];
let submissions: SubmitPublicFormInput[];

function visit(surface: "public" | "base" = "public") {
  const definition = openForm();
  if (definition.status !== "open") throw new Error("Expected an open fixture");
  const view: IBaseView = {
    id: "view-1",
    pageId: "page-1",
    name: "Event registration",
    type: "form",
    config: {},
    position: "a0",
    workspaceId: "workspace-1",
    creatorId: "author-1",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider env="test">
        <HelmetProvider>
          <MemoryRouter initialEntries={["/forms/registration"]}>
            <Link to="/forms/another">Other form</Link>
            {surface === "public" ? (
              <Routes>
                <Route path="/forms/:formKey" element={<PublicFormPage />} />
              </Routes>
            ) : (
              <FormRespond
                pageId="page-1"
                view={view}
                definition={definition.form}
              />
            )}
          </MemoryRouter>
        </HelmetProvider>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  queryClient.clear();
  requestedKeys = [];
  requestSignals = [];
  submissions = [];
  response = openForm();
  transport.post.mockReset();
  transport.post.mockImplementation(
    async (url: string, body: unknown, config?: { signal?: AbortSignal }) => {
      if (url === "/bases/forms/public/info") {
        requestedKeys.push((body as { key: string }).key);
        requestSignals.push(config?.signal);
        return { data: await response };
      }
      if (url === "/bases/forms/public/submit") {
        submissions.push(body as SubmitPublicFormInput);
        return { data: undefined };
      }
      if (url === "/bases/forms/share") {
        return {
          data: {
            viewId: "view-1",
            access: "public",
            key: "registration",
            publicSharingAllowed: true,
          },
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  );
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (media: string) => ({
      matches: false,
      media,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => true,
    }),
  });
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe.each(["public", "base"] as const)(
  "returning to a %s form",
  (surface) => {
    it("waits for the current questions and validates newly required answers", async () => {
      const first = visit(surface);
      await screen.findByRole("textbox", { name: "Name" });
      first.unmount();

      const refresh = deferred<PublicFormResponse>();
      response = refresh.promise;
      visit(surface);

      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
      await act(async () => {
        refresh.resolve(openForm({ fields: [nameField, emailField] }));
      });

      const email = await screen.findByRole("textbox", { name: "Work email" });
      expect(email).toHaveAttribute("aria-required", "true");
      fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
        target: { value: "Ada" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      expect(screen.getByRole("alert")).toBeVisible();
      expect(submissions).toEqual([]);
      fireEvent.change(email, { target: { value: "ada@example.com" } });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await screen.findByRole("heading", { name: "Thank you!" });
      expect(submissions).toMatchObject([
        {
          key: "registration",
          answers: { name: "Ada", email: "ada@example.com" },
        },
      ]);
      expect(requestedKeys).toEqual(["registration", "registration"]);
    });

    it("cannot use a previously open form after the owner closes it", async () => {
      const first = visit(surface);
      await screen.findByRole("textbox", { name: "Name" });
      first.unmount();
      response = { status: "closed" };
      visit(surface);

      await waitFor(() => expect(requestedKeys).toHaveLength(2));
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
      });
      if (surface === "public") {
        expect(
          screen.getByRole("heading", { name: "This form is closed" }),
        ).toBeVisible();
      } else {
        expect(
          screen.getByText("This form isn't accepting responses."),
        ).toBeVisible();
      }
    });

    it("does not offer a cached form when revalidation fails", async () => {
      const first = visit(surface);
      await screen.findByRole("textbox", { name: "Name" });
      first.unmount();
      const refresh = deferred<PublicFormResponse>();
      response = refresh.promise;
      visit(surface);
      await act(async () => refresh.reject(httpError(500)));

      await screen.findByRole("heading", { name: "Something went wrong" });
      expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
      expect(screen.queryByRole("textbox")).toBeNull();
      response = openForm({ fields: [nameField, emailField] });
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(
        await screen.findByRole("textbox", { name: "Work email" }),
      ).toBeVisible();
    });
  },
);

describe("public form background validation", () => {
  it.each(["focus", "reconnect"])(
    "keeps in-progress answers while checking current questions on %s",
    async (event) => {
      visit();
      fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
        target: { value: "Ada's unfinished answer" },
      });
      const refresh = deferred<PublicFormResponse>();
      response = refresh.promise;
      await act(async () => {
        if (event === "focus") {
          focusManager.setFocused(false);
          focusManager.setFocused(true);
        } else {
          onlineManager.setOnline(false);
          onlineManager.setOnline(true);
        }
      });

      await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
      expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
      await act(async () => {
        refresh.resolve(openForm({ fields: [nameField, emailField] }));
      });
      await screen.findByRole("textbox", { name: "Work email" });
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue(
        "Ada's unfinished answer",
      );
      expect(requestedKeys).toEqual(["registration", "registration"]);
    },
  );

  it("does not expose cached questions or the respondent after access becomes private", async () => {
    const prior = openForm({ title: "Staff survey", access: "workspace" });
    if (prior.status !== "open") throw new Error("Expected an open fixture");
    prior.respondent = {
      name: "Ada",
      email: "ada@example.com",
      avatarUrl: null,
    };
    response = prior;
    const first = visit();
    await screen.findByRole("heading", { name: "Staff survey" });
    first.unmount();
    const refresh = deferred<PublicFormResponse>();
    response = refresh.promise;
    visit();

    expect(screen.queryByText(/ada@example.com/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Staff survey" })).toBeNull();
    await waitFor(() => expect(document.title).toBe("Form"));
    await act(async () => {
      refresh.resolve({ status: "signInRequired", workspaceName: "Research" });
    });
    expect(
      await screen.findByRole("heading", {
        name: "Sign in to fill out this form",
      }),
    ).toBeVisible();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(/ada@example.com/)).toBeNull();
  });
});

describe("form refresh recovery", () => {
  it("ignores an earlier visit's unfinished request when returning to the form", async () => {
    const abandoned = deferred<PublicFormResponse>();
    response = abandoned.promise;
    const first = visit();
    await waitFor(() => expect(requestedKeys).toHaveLength(1));
    first.unmount();
    expect(requestSignals[0]?.aborted).toBe(true);
    response = openForm({ fields: [emailField] });
    visit();
    await act(async () => abandoned.resolve(openForm()));
    expect(
      await screen.findByRole("textbox", { name: "Work email" }),
    ).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  });

  it("keeps a shared request alive while another respondent is still mounted", async () => {
    const pending = deferred<PublicFormResponse>();
    response = pending.promise;
    const first = visit();
    visit();
    await waitFor(() => expect(requestedKeys).toHaveLength(1));
    first.unmount();
    expect(requestSignals[0]?.aborted).toBe(false);
    await act(async () => pending.resolve(openForm({ fields: [emailField] })));
    expect(
      await screen.findByRole("textbox", { name: "Work email" }),
    ).toBeVisible();
    expect(requestedKeys).toEqual(["registration"]);
  });

  it.each(["public", "base"] as const)(
    "keeps the %s draft after a failed background check and a successful retry",
    async (surface) => {
      visit(surface);
      fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
        target: { value: "Unfinished answer" },
      });
      const refresh = deferred<PublicFormResponse>();
      response = refresh.promise;
      await act(async () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });
      await act(async () => refresh.reject(httpError(500)));
      await screen.findByRole("heading", { name: "Something went wrong" });
      expect(screen.queryByRole("textbox")).toBeNull();
      response = openForm({ fields: [nameField, emailField] });
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await screen.findByRole("textbox", { name: "Work email" });
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue(
        "Unfinished answer",
      );
    },
  );

  it("revalidates cached questions even when their timestamp is ahead of the browser clock", async () => {
    queryClient.setQueryData(["public-form", "registration"], openForm(), {
      updatedAt: Date.now() + 60_000,
    });
    response = openForm({ fields: [emailField] });
    visit();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      await screen.findByRole("textbox", { name: "Work email" }),
    ).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  });

  it("asks the respondent to sign in when revalidation rejects their session", async () => {
    const first = visit();
    await screen.findByRole("textbox", { name: "Name" });
    first.unmount();
    const refresh = deferred<PublicFormResponse>();
    response = refresh.promise;
    visit();
    await act(async () => refresh.reject(httpError(401)));
    expect(
      await screen.findByRole("heading", {
        name: "Sign in to fill out this form",
      }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it.each(["navigate", "refocus"])(
    "does not retain a submit-time closure after %s loads an open form",
    async (event) => {
      visit();
      await screen.findByRole("textbox", { name: "Name" });
      transport.post.mockImplementationOnce(async () => {
        throw httpError(403);
      });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await screen.findByRole("heading", { name: "This form is closed" });
      response = openForm({ title: "Available form" });
      if (event === "navigate") {
        fireEvent.click(screen.getByRole("link", { name: "Other form" }));
      } else {
        await act(async () => {
          focusManager.setFocused(false);
          focusManager.setFocused(true);
        });
      }
      expect(
        await screen.findByRole("heading", { name: "Available form" }),
      ).toBeVisible();
      expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
    },
  );
});
