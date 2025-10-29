
import { NodeSelection, Selection } from "@tiptap/pm/state";
import { Editor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";

export const useEditorScroll = () => {
  const [scrollTo, setScrollTo] = useState<string>("");

  useEffect(() => {
    setScrollTo(window.location.hash ? window.location.hash.slice(1) : "");
  }, []);

  const handleScrollTo = useCallback(async (editor: Editor, _scrollTo: string | null = null, tryCount: number = 0) => {
    return new Promise(async (resolve, reject) => {
      console.log("tryCount", tryCount);
      const MAX_TRY_COUNT = 10;
      if(tryCount >= MAX_TRY_COUNT) {
        resolve(false);
        return;
      }
      _scrollTo = _scrollTo ? _scrollTo : scrollTo;
      if(_scrollTo) {
          const dom = editor.view.dom.querySelector(`[id="${_scrollTo}"]`)
          if (dom) {
              dom.scrollIntoView({ behavior: 'smooth', block: 'start' })
              const checkScroll = () => {
                const rect = dom.getBoundingClientRect();
                if(!document.body.contains(dom)) {
                  setTimeout(async () => {
                    resolve(await handleScrollTo(editor, _scrollTo, tryCount + 1));
                  }, 100);
                  window.removeEventListener("scroll", checkScroll);
                  return;
                }
                if (rect.top >= 0 && rect.top <= 100) { // within 10px of top
                  console.log("Reached target!");
                  resolve(true);
                  window.removeEventListener("scroll", checkScroll);
                }else{
                  setTimeout(() => {dom.scrollIntoView({ behavior: 'smooth', block: 'start' })}, 100);
                }

              };
              
              window.addEventListener("scroll", checkScroll);
              return;
          }
          setTimeout(async () => {
            resolve(await handleScrollTo(editor, _scrollTo, tryCount + 1));
          }, 100);
          return;
      }
      resolve(false);
      return;
    });
  }, [scrollTo]);

  return { scrollTo, handleScrollTo };
};