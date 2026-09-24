import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCollabAuthenticationRecovery } from "./auth-query";

describe("useCollabAuthenticationRecovery", () => {
  it("uses the cached token without refetching initially", async () => {
    const refetch = vi.fn().mockResolvedValue({
      data: { token: "token-2" },
    });
    const { result } = renderHook(() =>
      useCollabAuthenticationRecovery({ token: "token-1", refetch }),
    );

    await expect(result.current.getToken()).resolves.toBe("token-1");
    expect(refetch).not.toHaveBeenCalled();
  });

  it("refetches after an authentication failure even if the token is unchanged", async () => {
    const refetch = vi.fn().mockResolvedValue({
      data: { token: "token-1" },
    });
    const { result } = renderHook(() =>
      useCollabAuthenticationRecovery({ token: "token-1", refetch }),
    );
    const initialGetToken = result.current.getToken;

    act(() => {
      result.current.handleAuthenticationFailed();
    });

    expect(result.current.getToken).not.toBe(initialGetToken);
    await expect(result.current.getToken()).resolves.toBe("token-1");
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("coalesces repeated failures until the token provider runs", async () => {
    let resolveRefetch: (value: { data: { token: string } }) => void;
    const refetch = vi.fn(
      () =>
        new Promise<{ data: { token: string } }>((resolve) => {
          resolveRefetch = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useCollabAuthenticationRecovery({ token: "token-1", refetch }),
    );

    act(() => {
      result.current.handleAuthenticationFailed();
      result.current.handleAuthenticationFailed();
      result.current.handleAuthenticationFailed();
    });

    expect(refetch).not.toHaveBeenCalled();

    await act(async () => {
      const tokenPromise = result.current.getToken();
      result.current.handleAuthenticationFailed();
      resolveRefetch({ data: { token: "token-2" } });
      await expect(tokenPromise).resolves.toBe("token-2");
    });

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("stops after three failed recoveries until authentication succeeds", async () => {
    const refetch = vi.fn().mockResolvedValue({
      data: { token: "token-1" },
    });
    const { result } = renderHook(() =>
      useCollabAuthenticationRecovery({ token: "token-1", refetch }),
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
      act(() => {
        result.current.handleAuthenticationFailed();
      });
      await result.current.getToken();
    }

    const getTokenAfterLimit = result.current.getToken;
    act(() => {
      result.current.handleAuthenticationFailed();
    });

    expect(result.current.getToken).toBe(getTokenAfterLimit);
    await expect(result.current.getToken()).resolves.toBe("token-1");
    expect(result.current.isRecoveryExhausted).toBe(true);
    expect(refetch).toHaveBeenCalledTimes(3);

    act(() => {
      result.current.handleAuthenticated();
    });
    await expect(result.current.getToken()).resolves.toBe("token-1");
    expect(result.current.isRecoveryExhausted).toBe(false);
    expect(refetch).toHaveBeenCalledTimes(3);

    act(() => {
      result.current.handleAuthenticationFailed();
    });

    expect(result.current.getToken).not.toBe(getTokenAfterLimit);
    await result.current.getToken();
    expect(refetch).toHaveBeenCalledTimes(4);
  });

  it("unlocks recovery after a failed token request", async () => {
    const refetch = vi.fn().mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() =>
      useCollabAuthenticationRecovery({ token: "token-1", refetch }),
    );

    act(() => {
      result.current.handleAuthenticationFailed();
    });
    await expect(result.current.getToken()).rejects.toThrow("network error");

    act(() => {
      result.current.handleAuthenticationFailed();
    });
    await expect(result.current.getToken()).rejects.toThrow("network error");

    expect(refetch).toHaveBeenCalledTimes(2);
  });
});
