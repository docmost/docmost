import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { getApiErrorMessage } from "./api-error";

const requestError = (data: unknown) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    data,
    statusText: "",
    headers: {},
    config: {} as never,
  });

describe("getApiErrorMessage", () => {
  it("returns a string message", () => {
    expect(getApiErrorMessage(requestError({ message: "Name is taken" }))).toBe("Name is taken");
  });

  it("joins an array of messages", () => {
    expect(getApiErrorMessage(requestError({ message: ["a is required", "b is invalid"] }))).toBe(
      "a is required, b is invalid",
    );
  });

  it.each([
    ["an empty string", ""],
    ["a blank string", "   "],
    ["an empty array", []],
    ["no message", undefined],
  ])("falls back for %s", (_label, message) => {
    expect(getApiErrorMessage(requestError({ message }), "Fallback")).toBe("Fallback");
  });

  it("falls back for an error that is not an axios error", () => {
    expect(getApiErrorMessage(new Error("boom"), "Fallback")).toBe("Fallback");
    expect(getApiErrorMessage(new Error("boom"))).toBe("An error occurred");
  });
});
