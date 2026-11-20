import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createInstance, i18n as I18n } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { CoverCredit } from "./cover-credit";

let i18n: I18n;

// same interpolation setting as the app
beforeAll(async () => {
  i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: "en-US",
    resources: {},
    interpolation: { escapeValue: false },
  });
});

afterEach(cleanup);

function renderCredit(authorName: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <CoverCredit
        attribution={{
          source: "unsplash",
          photoId: "Abc_123",
          authorName,
          authorUsername: "ada",
        }}
      />
    </I18nextProvider>,
  );
}

describe("CoverCredit", () => {
  it("links the photographer and Unsplash", () => {
    renderCredit("Ada Lovelace");

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Ada Lovelace",
      "Unsplash",
    ]);
    expect(links[0].getAttribute("href")).toBe(
      "https://unsplash.com/@ada?utm_source=docmost&utm_medium=referral",
    );
  });

  it("shows markup in a name as text instead of rendering it", () => {
    const name =
      'x</author> <unsplash href="https://evil.example/login">Sign in</unsplash><author>';

    renderCredit(name);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toBe(name);
    expect(links.every((link) => link.getAttribute("href")?.startsWith("https://unsplash.com/"))).toBe(true);
  });

  it("survives a name that carries attributes", () => {
    expect(() => renderCredit('<author style="color:red">Ada</author>')).not.toThrow();
  });
});
