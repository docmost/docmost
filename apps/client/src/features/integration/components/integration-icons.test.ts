import type { ReactElement } from "react";
import { IconPuzzle } from "@tabler/icons-react";
import { describe, expect, it } from "vitest";
import { AzureDevOpsIcon, GithubIcon } from "@/components/icons";
import { getIntegrationIcon } from "./integration-icons";

const iconOf = (type: string) =>
  (getIntegrationIcon(type, 16) as ReactElement).type;

describe("getIntegrationIcon", () => {
  it.each([
    ["azure_devops", AzureDevOpsIcon],
    ["github", GithubIcon],
  ])("returns the %s icon", (type, icon) => {
    expect(iconOf(type)).toBe(icon);
  });

  it.each([
    "constructor",
    "__proto__",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "not_a_provider",
  ])("falls back to the generic icon for %s without throwing", (type) => {
    expect(() => getIntegrationIcon(type, 16)).not.toThrow();
    expect(iconOf(type)).toBe(IconPuzzle);
  });
});
