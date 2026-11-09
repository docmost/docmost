import { MantineProvider } from "@mantine/core";
import { AxiosError } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnouncementFormModal } from "./announcement-form-modal";
import { toPickerValue } from "../announcement.utils";
import * as service from "../services/announcement-service";
import type {
  IAnnouncement,
  IAnnouncementContent,
} from "../types/announcement.types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("../services/announcement-service");

const doc = (text: string): IAnnouncementContent => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

vi.mock("./announcement-message-editor", () => ({
  AnnouncementMessageEditor: (props: {
    initialContent: IAnnouncementContent | null;
    onChange: (content: IAnnouncementContent) => void;
    error?: string;
  }) => (
    <div>
      <textarea
        aria-label="Message"
        aria-invalid={props.error ? "true" : undefined}
        defaultValue={props.initialContent?.content[0].content[0]?.text ?? ""}
        onChange={(event) =>
          props.onChange({
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: event.target.value
                  ? [{ type: "text", text: event.target.value }]
                  : [],
              },
            ],
          })
        }
      />
      {props.error && <p>{props.error}</p>}
    </div>
  ),
}));

vi.mock("@mantine/dates", () => ({
  DateTimePicker: (props: {
    label: string;
    placeholder: string;
    value: string | null;
    onChange: (value: string | null) => void;
    clearButtonProps?: { "aria-label": string };
    error?: string;
  }) => (
    <div>
      <input
        aria-label={props.label}
        aria-invalid={props.error ? "true" : undefined}
        placeholder={props.placeholder}
        value={props.value ?? ""}
        onChange={(event) => props.onChange(event.target.value || null)}
      />
      {props.value && (
        <button type="button" {...props.clearButtonProps}>
          x
        </button>
      )}
      {props.error && <p>{props.error}</p>}
    </div>
  ),
}));

const stored = (overrides: Partial<IAnnouncement> = {}): IAnnouncement => ({
  id: "a1",
  type: "warning",
  color: "yellow",
  content: doc("Planned maintenance"),
  isDismissible: true,
  audience: "everyone",
  startsAt: "2026-11-04T09:00:00.123Z",
  endsAt: "2099-01-01T10:00:00.456Z",
  archivedAt: null,
  status: "active",
  createdAt: "2026-11-03T09:00:00.000Z",
  updatedAt: "2026-11-03T09:00:00.000Z",
  ...overrides,
});

const requestError = (data: unknown, status = 409) =>
  new AxiosError(
    `Request failed with status code ${status}`,
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    { status, data, statusText: "", headers: {}, config: {} as never },
  );

function renderModal(announcement: IAnnouncement | null = null) {
  const onClose = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider env="test">
        <MemoryRouter>
          <AnnouncementFormModal
            opened
            onClose={onClose}
            announcement={announcement}
          />
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

const typeMessage = (text: string) =>
  fireEvent.change(screen.getByRole("textbox", { name: "Message" }), {
    target: { value: text },
  });

const submit = (label = "Create") =>
  fireEvent.click(screen.getByRole("button", { name: label }));

const choose = (field: string, option: string) => {
  fireEvent.click(screen.getByRole("combobox", { name: field }));
  fireEvent.click(screen.getByRole("option", { name: option }));
};

beforeEach(() => {
  vi.resetAllMocks();
  // the Select dropdown scrolls its selected option into view
  Element.prototype.scrollIntoView = () => {};
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

describe("AnnouncementFormModal", () => {
  it("creates an info announcement for logged-in users that starts now and never ends", async () => {
    vi.mocked(service.createAnnouncement).mockResolvedValue(stored());
    const { onClose } = renderModal();
    expect(screen.getByRole("dialog", { name: "New announcement" })).toBeTruthy();

    typeMessage("Maintenance tonight");
    submit();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(service.createAnnouncement).mock.calls[0][0]).toEqual({
      type: "info",
      color: "blue",
      content: doc("Maintenance tonight"),
      isDismissible: false,
      audience: "members",
      startsAt: null,
      endsAt: null,
    });
  });

  it("preselects the type's color and still lets the admin pick another", async () => {
    vi.mocked(service.createAnnouncement).mockResolvedValue(stored());
    const { onClose } = renderModal();
    const colors = screen.getByRole("radiogroup", { name: "Color" });

    choose("Type", "Critical");
    expect(
      within(colors).getByRole("radio", { name: "Red" }).getAttribute("aria-checked"),
    ).toBe("true");

    fireEvent.click(within(colors).getByRole("radio", { name: "Purple" }));
    typeMessage("Outage");
    submit();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(service.createAnnouncement).mock.calls[0][0]).toMatchObject({
      type: "critical",
      color: "purple",
    });
  });

  it("moves the color selection with the arrow keys", () => {
    renderModal();
    const blue = screen.getByRole("radio", { name: "Blue" });
    expect(blue.getAttribute("tabindex")).toBe("0");

    fireEvent.keyDown(blue, { key: "ArrowRight" });

    const green = screen.getByRole("radio", { name: "Green" });
    expect(green.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(green);
  });

  it("shows a validation error and sends nothing", () => {
    renderModal();
    submit();
    expect(screen.getByText("Announcement message is required")).toBeTruthy();
    expect(service.createAnnouncement).not.toHaveBeenCalled();
  });

  it("moves focus to the first invalid field after a failed submit", async () => {
    renderModal();
    submit();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("textbox", { name: "Message" }),
      ),
    );
  });

  it("names the clear buttons of both dates", () => {
    renderModal(stored());
    expect(screen.getByRole("button", { name: "Clear start time" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear end time" })).toBeTruthy();
  });

  it("describes the Everyone audience before it is chosen", () => {
    renderModal();
    const audience = screen.getByRole("combobox", { name: "Audience" });
    expect(audience.getAttribute("aria-describedby")).toBeTruthy();
    expect(
      document.getElementById(audience.getAttribute("aria-describedby"))
        ?.textContent,
    ).toBe("Everyone also includes the login page and public pages.");
  });

  it("shows the preview once the message has text", () => {
    renderModal();
    expect(screen.queryByText("Preview")).toBeNull();

    typeMessage("Maintenance tonight");

    expect(screen.getByText("Preview")).toBeTruthy();
    expect(screen.getByText("Maintenance tonight")).toBeTruthy();
  });

  it("shows empty times as Now and No end", async () => {
    renderModal();
    const starts = await screen.findByRole("textbox", { name: "Starts" });
    const ends = screen.getByRole("textbox", { name: "Ends" });
    expect([starts, ends].map((input) => input.getAttribute("placeholder"))).toEqual([
      "Now",
      "No end",
    ]);
  });

  it("sends the times it was given untouched when editing", async () => {
    const announcement = stored();
    vi.mocked(service.updateAnnouncement).mockResolvedValue(announcement);
    const { onClose } = renderModal(announcement);
    expect(screen.getByRole("dialog", { name: "Edit announcement" })).toBeTruthy();
    expect(
      (await screen.findByRole("textbox", { name: "Starts" }) as HTMLInputElement).value,
    ).toBe(toPickerValue(announcement.startsAt));

    typeMessage("Planned maintenance moved");
    submit("Save");

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(service.updateAnnouncement).mock.calls[0][0]).toEqual({
      announcementId: "a1",
      type: "warning",
      color: "yellow",
      content: doc("Planned maintenance moved"),
      isDismissible: true,
      audience: "everyone",
      startsAt: "2026-11-04T09:00:00.123Z",
      endsAt: "2099-01-01T10:00:00.456Z",
    });
  });

  it("saves other fields of an ended announcement without moving its end", async () => {
    const ended = stored({ status: "ended", endsAt: "2020-01-01T18:00:00.789Z", startsAt: "2019-12-30T09:00:00.000Z" });
    vi.mocked(service.updateAnnouncement).mockResolvedValue(ended);
    const { onClose } = renderModal(ended);
    await screen.findByRole("textbox", { name: "Ends" });

    choose("Audience", "Logged-in users");
    submit("Save");

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(service.updateAnnouncement).mock.calls[0][0]).toMatchObject({
      audience: "members",
      endsAt: "2020-01-01T18:00:00.789Z",
    });
  });

  it("explains a limit conflict in the alert", async () => {
    vi.mocked(service.createAnnouncement).mockRejectedValue(
      requestError({
        message: "Up to two announcements can show at the same time",
        conflict: {
          from: "2026-11-05T09:00:00.000Z",
          to: "2026-11-05T18:00:00.000Z",
          announcements: [
            { id: "b", preview: "Acceptable use policy" },
            { id: "c", preview: "Holiday hours" },
          ],
        },
      }),
    );
    const { onClose } = renderModal();
    typeMessage("Maintenance tonight");
    submit();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Up to two announcements can show at the same time.")).toBeTruthy();
    expect(within(alert).getByText("Acceptable use policy")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows any other server error above the fields", async () => {
    vi.mocked(service.createAnnouncement).mockRejectedValue(
      requestError({ message: "Unsupported link in announcement message" }, 400),
    );
    renderModal();
    typeMessage("Maintenance tonight");
    submit();

    expect(
      within(await screen.findByRole("alert")).getByText(
        "Unsupported link in announcement message",
      ),
    ).toBeTruthy();
  });
});
