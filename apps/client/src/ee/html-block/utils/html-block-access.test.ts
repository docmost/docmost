import { afterEach, describe, expect, it, vi } from "vitest";
import { getDefaultStore } from "jotai";
import { canEditHtmlBlocksNow, getHtmlBlockAccess } from "./html-block-access";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { ICurrentUser } from "@/features/user/types/user.types";
import { Feature } from "@/ee/features";
import * as config from "@/lib/config";

describe("getHtmlBlockAccess", () => {
  it("canEdit is true when enabled and licensed", () => {
    expect(
      getHtmlBlockAccess({
        settings: { enabled: true },
        licensed: true,
        disabledOnServer: false,
      }),
    ).toEqual({ enabled: true, licensed: true, canEdit: true });
  });

  it("canEdit is false when disabled or unlicensed", () => {
    expect(
      getHtmlBlockAccess({
        settings: { enabled: false },
        licensed: true,
        disabledOnServer: false,
      }),
    ).toEqual({ enabled: false, licensed: true, canEdit: false });
    expect(
      getHtmlBlockAccess({
        settings: undefined,
        licensed: true,
        disabledOnServer: false,
      }),
    ).toEqual({ enabled: false, licensed: true, canEdit: false });
    expect(
      getHtmlBlockAccess({
        settings: { enabled: true },
        licensed: false,
        disabledOnServer: false,
      }),
    ).toEqual({ enabled: true, licensed: false, canEdit: false });
  });

  it("treats blocks as off when disabled on the server", () => {
    expect(
      getHtmlBlockAccess({
        settings: { enabled: true },
        licensed: true,
        disabledOnServer: true,
      }),
    ).toEqual({ enabled: false, licensed: true, canEdit: false });
  });
});

describe("canEditHtmlBlocksNow", () => {
  const store = getDefaultStore();

  const signIn = (role: string, htmlBlocks: Record<string, boolean>) =>
    store.set(currentUserAtom, {
      user: { role },
      workspace: { settings: { htmlBlocks } },
    } as unknown as ICurrentUser);

  afterEach(() => {
    store.set(currentUserAtom, null);
    store.set(entitlementAtom, null);
    vi.restoreAllMocks();
  });

  it("reads the workspace switch and the license from the store, for every role", () => {
    store.set(entitlementAtom, {
      cloud: false,
      tier: "business",
      features: [Feature.HTML_BLOCKS],
    });

    for (const role of ["owner", "admin", "member"]) {
      signIn(role, { enabled: true });
      expect(canEditHtmlBlocksNow()).toBe(true);
    }

    signIn("admin", { enabled: false });
    expect(canEditHtmlBlocksNow()).toBe(false);

    store.set(entitlementAtom, { cloud: false, tier: "free", features: [] });
    signIn("owner", { enabled: true });
    expect(canEditHtmlBlocksNow()).toBe(false);
  });

  it("is false when the server disables HTML blocks", () => {
    vi.spyOn(config, "isDisableHtmlBlocks").mockReturnValue(true);
    store.set(entitlementAtom, {
      cloud: false,
      tier: "business",
      features: [Feature.HTML_BLOCKS],
    });

    signIn("owner", { enabled: true });
    expect(canEditHtmlBlocksNow()).toBe(false);
  });

  it("is false when nobody is signed in", () => {
    expect(canEditHtmlBlocksNow()).toBe(false);
  });
});
