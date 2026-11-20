import { memo, Suspense, useLayoutEffect, useState } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { useDestroyEditorBeforeChildren } from "./use-destroy-editor-before-children";

const seen: { editor: Editor | null; destroyedInChildCleanup: boolean | null } =
  { editor: null, destroyedInChildCleanup: null };

function Child({ editor }: { editor: Editor }) {
  useLayoutEffect(
    () => () => {
      seen.destroyedInChildCleanup = editor.isDestroyed;
    },
    [editor],
  );
  return null;
}

// memo: nothing re-renders this component from outside
const Host = memo(function Host() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: "<p>Hello</p>",
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
  });
  useDestroyEditorBeforeChildren(editor);
  seen.editor = editor;

  return (
    <>
      <EditorContent editor={editor} />
      {editor && <Child editor={editor} />}
    </>
  );
});

const gate: { suspend: () => void; resume: () => void; open: boolean } = {
  suspend: () => {},
  resume: () => {},
  open: true,
};

function Gate() {
  const [pending, setPending] = useState<Promise<void> | null>(null);
  gate.suspend = () => {
    gate.open = false;
    setPending(
      new Promise<void>((resolve) => {
        gate.resume = () => {
          gate.open = true;
          resolve();
        };
      }),
    );
  };
  if (pending && !gate.open) throw pending;
  return null;
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

afterEach(() => {
  cleanup();
  seen.editor = null;
  seen.destroyedInChildCleanup = null;
  gate.open = true;
});

describe("useDestroyEditorBeforeChildren", () => {
  it("destroys the editor before the cleanups of its children run", async () => {
    const view = render(<Host />);
    await settle();
    const editor = seen.editor!;
    expect(editor.isDestroyed).toBe(false);

    view.unmount();

    expect(seen.destroyedInChildCleanup).toBe(true);
    expect(editor.isDestroyed).toBe(true);
  });

  it("gets a working editor back after React hides and reveals the subtree", async () => {
    const view = render(
      <Suspense fallback={<span>loading</span>}>
        <Host />
        <Gate />
      </Suspense>,
    );
    await settle();
    const first = seen.editor!;

    act(() => gate.suspend());
    // hiding runs layout cleanups, so the first editor is gone
    expect(first.isDestroyed).toBe(true);

    await act(async () => gate.resume());
    await settle();

    expect(seen.editor).not.toBe(first);
    expect(seen.editor!.isDestroyed).toBe(false);
    expect(view.container.querySelector(".tiptap")?.textContent).toBe("Hello");
  });
});
