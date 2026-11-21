import { afterEach, describe, expect, it } from "vitest";
import { getDefaultStore } from "jotai";
import { canEditHtmlBlocksNow, getHtmlBlockAccess } from "./html-block-access";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { ICurrentUser } from "@/features/user/types/user.types";
import { Feature } from "@/ee/features";

describe("getHtmlBlockAccess", () => {
  it("canEdit is false for members when not allowed", () => {
    expect(
      getHtmlBlockAccess({
        settings: { enabled: true, allowMembers: false },
        isAdmin: false,
        licensed: true,
      }),
    ).toEqual({ enabled: true, licensed: true, canEdit: false });
    expect(
      getHtmlBlockAccess({
        settings: { enabled: true },
        isAdmin: false,
        licensed: true,
      }).canEdit,
    ).toBe(false);
  });

  it("canEdit is true for members when allowed", () => {
    expect(
      getHtmlBlockAccess({
        settings: { enabled: true, allowMembers: true },
        isAdmin: false,
        licensed: true,
      }).canEdit,
    ).toBe(true);
  });

  it("canEdit is true for admins when enabled and licensed", () => {
    expect(
      getHtmlBlockAccess({
        settings: { enabled: true },
        isAdmin: true,
        licensed: true,
      }),
    ).toEqual({ enabled: true, licensed: true, canEdit: true });
  });

  it("canEdit is false when disabled or unlicensed", () => {
    expect(
      getHtmlBlockAccess({
        settings: { enabled: false, allowMembers: true },
        isAdmin: true,
        licensed: true,
      }),
    ).toEqual({ enabled: false, licensed: true, canEdit: false });
    expect(
      getHtmlBlockAccess({ settings: undefined, isAdmin: true, licensed: true }),
    ).toEqual({ enabled: false, licensed: true, canEdit: false });
    expect(
      getHtmlBlockAccess({
        settings: { enabled: true, allowMembers: true },
        isAdmin: true,
        licensed: false,
      }),
    ).toEqual({ enabled: true, licensed: false, canEdit: false });
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
  });

  it("reads the role, the workspace switch and the license from the store", () => {
    store.set(entitlementAtom, {
      cloud: false,
      tier: "business",
      features: [Feature.HTML_BLOCKS],
    });

    signIn("owner", { enabled: true });
    expect(canEditHtmlBlocksNow()).toBe(true);

    signIn("admin", { enabled: true });
    expect(canEditHtmlBlocksNow()).toBe(true);

    signIn("member", { enabled: true });
    expect(canEditHtmlBlocksNow()).toBe(false);

    signIn("member", { enabled: true, allowMembers: true });
    expect(canEditHtmlBlocksNow()).toBe(true);

    signIn("admin", { enabled: false });
    expect(canEditHtmlBlocksNow()).toBe(false);

    store.set(entitlementAtom, { cloud: false, tier: "free", features: [] });
    signIn("owner", { enabled: true });
    expect(canEditHtmlBlocksNow()).toBe(false);
  });

  it("is false when nobody is signed in", () => {
    expect(canEditHtmlBlocksNow()).toBe(false);
  });
});
