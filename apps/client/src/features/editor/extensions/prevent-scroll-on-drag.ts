import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const PreventScrollOnDragKey = new PluginKey("prevent-scroll-on-drag");

export const PreventScrollOnDrag = Extension.create({
  name: "prevent-scroll-on-drag",

  addProseMirrorPlugins() {
    const extensionThis = this;

    return [
      new Plugin({
        key: PreventScrollOnDragKey,

        props: {
          handleDOMEvents: {
            dragstart: (_view, event) => {
              if (!(event instanceof DragEvent)) return false;
              if (!event.dataTransfer) return false;

              const dragHandle = document.querySelector(".drag-handle");
              if (!dragHandle) return false;

              const scrollY = window.scrollY;
              window.scrollTo({ top: scrollY, behavior: "instant" });

              const handleDrag = (e: DragEvent) => {
                e.preventDefault();
                window.scrollTo({ top: scrollY, behavior: "instant" });
              };

              const handleDragEnd = () => {
                document.removeEventListener("drag", handleDrag, true);
                document.removeEventListener("dragend", handleDragEnd, true);
              };

              document.addEventListener("drag", handleDrag, true);
              document.addEventListener("dragend", handleDragEnd, true);

              return false;
            },
          },
        },
      }),
    ];
  },
});
