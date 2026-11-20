import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDiagramSave } from "./use-diagram-save";

// a save that runs until the test finishes or fails it
function slowSave(log: string[], name: string) {
  let finish!: () => void;
  let fail!: (err: Error) => void;
  const done = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const task = () => {
    log.push(name);
    return done;
  };
  return { task, finish, fail };
}

// lets every queued promise callback run
const settle = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve)));

describe("useDiagramSave", () => {
  it("holds a requested save until the save in flight is done", async () => {
    const log: string[] = [];
    const { result } = renderHook(() => useDiagramSave());
    const autosave = slowSave(log, "autosave");
    const requested = slowSave(log, "requested");

    act(() => {
      result.current.autosave(autosave.task);
      result.current.save(requested.task).then(() => log.push("saved"));
    });
    await settle();
    expect(log).toEqual(["autosave"]);

    autosave.finish();
    await settle();
    expect(log).toEqual(["autosave", "requested"]);

    requested.finish();
    await settle();
    expect(log).toEqual(["autosave", "requested", "saved"]);
  });

  it("skips an autosave while another save is in flight", async () => {
    const log: string[] = [];
    const { result } = renderHook(() => useDiagramSave());
    const requested = slowSave(log, "requested");
    const autosave = slowSave(log, "autosave");

    act(() => {
      result.current.save(requested.task);
      result.current.autosave(autosave.task);
    });
    requested.finish();
    await settle();

    expect(log).toEqual(["requested"]);
  });

  it("runs a requested save once when it is asked for again before it is done", async () => {
    const log: string[] = [];
    const { result } = renderHook(() => useDiagramSave());
    const first = slowSave(log, "first");
    const again = slowSave(log, "again");

    act(() => {
      result.current.save(first.task).then(() => log.push("first saved"));
      result.current.save(again.task).then(() => log.push("again saved"));
    });
    first.finish();
    await settle();

    expect(log).toEqual(["first", "first saved", "again saved"]);
  });

  it("runs a requested save after the save before it failed", async () => {
    const log: string[] = [];
    const { result } = renderHook(() => useDiagramSave());
    const autosave = slowSave(log, "autosave");
    const requested = slowSave(log, "requested");

    act(() => {
      result.current.autosave(autosave.task).catch(() => {});
      result.current.save(requested.task);
    });
    autosave.fail(new Error("offline"));
    await settle();

    expect(log).toEqual(["autosave", "requested"]);
  });

  it("hands a failed save to its caller and takes the next one", async () => {
    const log: string[] = [];
    const { result } = renderHook(() => useDiagramSave());
    const failing = slowSave(log, "failing");
    const retry = slowSave(log, "retry");

    let failure: Error;
    act(() => {
      result.current.save(failing.task).catch((err) => (failure = err));
    });
    failing.fail(new Error("offline"));
    await settle();
    expect(failure.message).toBe("offline");
    expect(result.current.isSaving).toBe(false);

    act(() => {
      result.current.save(retry.task);
    });
    await settle();
    expect(log).toEqual(["failing", "retry"]);
  });

  it("shows as saving from the first save until the last one is done", async () => {
    const log: string[] = [];
    const { result } = renderHook(() => useDiagramSave());
    const autosave = slowSave(log, "autosave");
    const requested = slowSave(log, "requested");

    act(() => {
      result.current.autosave(autosave.task);
      result.current.save(requested.task);
    });
    expect(result.current.isSaving).toBe(true);
    expect(result.current.isSavingRef.current).toBe(true);

    autosave.finish();
    await settle();
    expect(result.current.isSaving).toBe(true);
    expect(result.current.isSavingRef.current).toBe(true);

    requested.finish();
    await settle();
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isSavingRef.current).toBe(false);
  });
});
