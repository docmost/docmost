import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Storage {
    shared: Record<string, any>;
  }
}

const SharedStorage = Extension.create({
  name: "shared",

  addStorage() {
    return {};
  },
});

export { SharedStorage };
