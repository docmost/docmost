import { AxiosError, type AxiosAdapter } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api-client";

vi.mock("@/lib/config.ts", () => ({ isCloud: () => false }));

const PAGE_URL = "http://localhost/s/general/p/policy-abc";

const respondWith =
  (status: number): AxiosAdapter =>
  async (config) => {
    throw new AxiosError(
      `Request failed with status code ${status}`,
      AxiosError.ERR_BAD_REQUEST,
      config,
      { responseURL: `http://localhost/api${config.url}` },
      { status, statusText: "", headers: {}, config, data: {} },
    );
  };

let location: { pathname: string; search: string; hash: string; href: string };

beforeEach(() => {
  location = {
    pathname: "/s/general/p/policy-abc",
    search: "",
    hash: "",
    href: PAGE_URL,
  };
  vi.stubGlobal("location", location);
});

afterEach(() => vi.unstubAllGlobals());

describe("api client on 401", () => {
  it("rejects the background banner poll without sending the reader to the login page", async () => {
    await expect(
      api.post("/announcements/visible", undefined, {
        adapter: respondWith(401),
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(location.href).toBe(PAGE_URL);
  });

  it("sends the reader to the login page for any other request", async () => {
    await expect(
      api.post("/pages/info", undefined, { adapter: respondWith(401) }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(location.href).toBe(
      "/login?redirect=%2Fs%2Fgeneral%2Fp%2Fpolicy-abc",
    );
  });
});
