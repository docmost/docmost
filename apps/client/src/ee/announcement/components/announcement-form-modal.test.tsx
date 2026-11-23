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
  title: "Maintenance window",
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

const typeTitle = (text: string) =>
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
    target: { value: text },
  });

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

    typeTitle("Maintenance");
    typeMessage("Maintenance tonight");
    submit();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(service.createAnnouncement).mock.calls[0][0]).toEqual({
      title: "Maintenance",
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
    typeTitle("Outage");
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
    expect(screen.getByText("Announcement title is required")).toBeTruthy();
    expect(screen.getByText("Announcement message is required")).toBeTruthy();
    expect(service.createAnnouncement).not.toHaveBeenCalled();
  });

  it("moves focus to the first invalid field after a failed submit", async () => {
    renderModal();
    submit();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("textbox", { name: "Title" }),
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

    typeTitle("Maintenance");
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
      title: "Maintenance window",
      type: "warning",
      color: "yellow",
      content: doc("Planned maintenance moved"),
      isDismissible: true,
      audience: "everyone",
      startsAt: "2026-11-04T09:00:00.123Z",
      endsAt: "2099-01-01T10:00:00.456Z",
    });
  });

  it("saves other fields of an expired announcement without moving its end", async () => {
    const expired = stored({ status: "archived", endsAt: "2020-01-01T18:00:00.789Z", startsAt: "2019-12-30T09:00:00.000Z" });
    vi.mocked(service.updateAnnouncement).mockResolvedValue(expired);
    const { onClose } = renderModal(expired);
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
        message: "Only one announcement can show at a time",
        conflict: {
          from: "2026-11-05T09:00:00.000Z",
          to: "2026-11-05T18:00:00.000Z",
          announcements: [
            { id: "b", title: "Acceptable use policy" },
          ],
        },
      }),
    );
    const { onClose } = renderModal();
    typeTitle("Maintenance");
    typeMessage("Maintenance tonight");
    submit();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Only one announcement can show at a time.")).toBeTruthy();
    expect(within(alert).getByText("Acceptable use policy")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  describe("when the save would replace another announcement", () => {
    const replaceAnswer = {
      message: "This replaces another announcement",
      replaces: [
        { id: "b", title: "Acceptable use policy", at: "2026-11-05T09:00:00.000Z" },
      ],
      replacedBy: [
        { id: "c", title: "Holiday hours", at: "2026-12-20T09:00:00.000Z" },
      ],
    };

    async function triggerReplaceAnswer() {
      vi.mocked(service.createAnnouncement).mockRejectedValueOnce(
        requestError(replaceAnswer),
      );
      const { onClose } = renderModal();
      typeTitle("Maintenance");
      typeMessage("Maintenance tonight");
      submit();
      const alert = await screen.findByRole("alert");
      return { alert, onClose };
    }

    it("lists what is archived when this one starts and when another one does", async () => {
      const { alert, onClose } = await triggerReplaceAnswer();

      expect(
        within(alert).getByText(
          "\u201cAcceptable use policy\u201d will be archived when this one starts.",
        ),
      ).toBeTruthy();
      expect(
        within(alert).getByText(
          "This one will be archived when \u201cHoliday hours\u201d starts.",
        ),
      ).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("scrolls the notice into view when it appears", async () => {
      const scrolled: Element[] = [];
      Element.prototype.scrollIntoView = function (this: Element) {
        scrolled.push(this);
      };
      const { alert } = await triggerReplaceAnswer();

      await waitFor(() => expect(scrolled).toContain(alert));
    });

    it("switches the submit label and sends replace on the next submit", async () => {
      const { onClose } = await triggerReplaceAnswer();
      expect(vi.mocked(service.createAnnouncement).mock.calls[0][0]).not.toHaveProperty(
        "replace",
      );
      vi.mocked(service.createAnnouncement).mockResolvedValue(stored());

      expect(screen.queryByRole("button", { name: "Create" })).toBeNull();
      submit("Save and replace");

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(vi.mocked(service.createAnnouncement).mock.calls[1][0]).toMatchObject({
        title: "Maintenance",
        replace: true,
      });
    });

    it("sends replace when editing too", async () => {
      vi.mocked(service.updateAnnouncement).mockRejectedValueOnce(
        requestError(replaceAnswer),
      );
      const { onClose } = renderModal(stored());
      await screen.findByRole("textbox", { name: "Starts" });
      submit("Save");
      await screen.findByRole("alert");
      vi.mocked(service.updateAnnouncement).mockResolvedValue(stored());

      submit("Save and replace");

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(vi.mocked(service.updateAnnouncement).mock.calls[1][0]).toMatchObject({
        announcementId: "a1",
        replace: true,
      });
    });

    it.each(["Starts", "Ends"])(
      "clears the notice and the confirmation when the %s time changes",
      async (field) => {
        await triggerReplaceAnswer();

        fireEvent.change(screen.getByRole("textbox", { name: field }), {
          target: { value: "2099-06-01 10:00:00" },
        });

        expect(screen.queryByRole("alert")).toBeNull();
        expect(screen.queryByRole("button", { name: "Save and replace" })).toBeNull();
        vi.mocked(service.createAnnouncement).mockRejectedValueOnce(
          requestError(replaceAnswer),
        );
        submit();
        await screen.findByRole("alert");
        expect(vi.mocked(service.createAnnouncement).mock.calls[1][0]).not.toHaveProperty(
          "replace",
        );
      },
    );
  });

  it("shows any other server error above the fields", async () => {
    vi.mocked(service.createAnnouncement).mockRejectedValue(
      requestError({ message: "Unsupported link in announcement message" }, 400),
    );
    renderModal();
    typeTitle("Maintenance");
    typeMessage("Maintenance tonight");
    submit();

    expect(
      within(await screen.findByRole("alert")).getByText(
        "Unsupported link in announcement message",
      ),
    ).toBeTruthy();
  });
});
