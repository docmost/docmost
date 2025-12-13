import { Editor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";

function waitForState(checkFn: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (checkFn()) {
        clearInterval(interval);
        resolve();
      }
    }, 800);
  });
}

export const useEditorScroll = ({
  canScroll,
  initialScrollTo,
}: {
  canScroll: () => boolean;
  initialScrollTo?: string;
}) => {
  const [scrollTo, setScrollTo] = useState<string>(initialScrollTo || "");

  useEffect(() => {
    if (!initialScrollTo) {
      setScrollTo(window.location.hash ? window.location.hash.slice(1) : "");
    }
  }, [initialScrollTo]);

  const handleScrollTo = useCallback(async (editor: Editor, _scrollTo: string | null = null, tryCount: number = 0) => {
    await waitForState(() => canScroll());
    return new Promise((resolve) => {
      const MAX_TRY_COUNT = 10;
      if (tryCount >= MAX_TRY_COUNT) {
        resolve(false);
        return;
      }

      const targetId = _scrollTo || scrollTo;
      if (!targetId) {
        resolve(false);
        return;
      }

      const dom = editor.view.dom.querySelector(`[id="${targetId}"]`);
      if (dom) {
        dom.scrollIntoView({ behavior: 'smooth', block: 'start' });
        resolve(true);
      } else {
        setTimeout(async () => {
          resolve(await handleScrollTo(editor, targetId, tryCount + 1));
        }, 200);
      }
    });
  }, [scrollTo, canScroll]);

  return { scrollTo, handleScrollTo };
};
