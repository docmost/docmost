import { MantineProvider } from "@mantine/core";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IntegrationDisplayMenu,
  IntegrationDisplayPicker,
} from "./integration-display-picker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (value: string) => value }),
}));

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

function renderPicker(
  props: Partial<React.ComponentProps<typeof IntegrationDisplayPicker>> = {},
) {
  const onChange = vi.fn();
  render(
    <MantineProvider>
      <IntegrationDisplayPicker
        current="card"
        label="Display as"
        canUseCard
        onChange={onChange}
        {...props}
      />
    </MantineProvider>,
  );
  return { onChange };
}

function renderMenu(
  props: Partial<React.ComponentProps<typeof IntegrationDisplayMenu>> = {},
) {
  const onChange = vi.fn();
  render(
    <MantineProvider>
      <IntegrationDisplayMenu
        current="url"
        label="Display as"
        canUseCard
        onChange={onChange}
        {...props}
      />
    </MantineProvider>,
  );
  return { onChange };
}

describe("IntegrationDisplayPicker", () => {
  beforeEach(setMediaMatch);
  afterEach(cleanup);

  it("exposes every display mode directly and identifies the selected mode", () => {
    renderPicker({ current: "mention" });

    expect(screen.getByRole("radiogroup", { name: "Display as" })).toBeTruthy();

    const card = screen.getByRole("radio", { name: "Card" });
    const mention = screen.getByRole("radio", { name: "Mention" });
    const url = screen.getByRole("radio", { name: "URL" });

    expect(card.getAttribute("aria-checked")).toBe("false");
    expect(card.getAttribute("tabindex")).toBe("-1");
    expect(mention.getAttribute("aria-checked")).toBe("true");
    expect(mention.getAttribute("tabindex")).toBe("0");
    expect(url.getAttribute("aria-checked")).toBe("false");
  });

  it("changes mode with standard radio-group arrow navigation", () => {
    const { onChange } = renderPicker({ current: "card" });
    const card = screen.getByRole("radio", { name: "Card" });

    card.focus();
    fireEvent.keyDown(card, { key: "ArrowRight" });

    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: "Mention" }),
    );
    expect(onChange).toHaveBeenCalledWith("mention");
  });

  it("keeps an unavailable card understandable and skips it during navigation", () => {
    const { onChange } = renderPicker({
      current: "url",
      canUseCard: false,
    });

    const card = screen.getByRole("radio", { name: "Card" });
    expect(card.getAttribute("aria-disabled")).toBe("true");
    const reasonId = card.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId!)?.textContent).toBe(
      "Cards aren't available in this position",
    );

    fireEvent.click(card);
    expect(onChange).not.toHaveBeenCalled();

    const url = screen.getByRole("radio", { name: "URL" });
    url.focus();
    fireEvent.keyDown(url, { key: "ArrowRight" });
    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: "Mention" }),
    );
    expect(onChange).toHaveBeenCalledWith("mention");
  });

  it("reports activation of the current mode so the paste nudge can close", () => {
    const { onChange } = renderPicker({ current: "card" });

    fireEvent.click(screen.getByRole("radio", { name: "Card" }));

    expect(onChange).toHaveBeenCalledWith("card");
  });
});

describe("IntegrationDisplayMenu", () => {
  beforeEach(setMediaMatch);
  afterEach(cleanup);

  it("identifies the current display and changes it from the dropdown", async () => {
    const { onChange } = renderMenu();
    const trigger = screen.getByRole("button", { name: "Display as: URL" });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(
      (
        await screen.findByRole("menuitemradio", {
          name: "URL",
          hidden: true,
        })
      ).getAttribute("aria-checked"),
    ).toBe("true");

    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "Mention", hidden: true }),
    );
    expect(onChange).toHaveBeenCalledWith("mention");
  });

  it("supports keyboard opening, option navigation, and Escape", async () => {
    renderMenu({ canUseCard: false });
    const trigger = screen.getByRole("button", { name: "Display as: URL" });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const url = await screen.findByRole("menuitemradio", {
      name: "URL",
      hidden: true,
    });
    await waitFor(() => expect(document.activeElement).toBe(url));

    fireEvent.keyDown(url, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitemradio", { name: "Mention", hidden: true }),
    );

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
