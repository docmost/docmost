const { JSDOM } = require("jsdom");
const { setTimeout: delay } = require("node:timers/promises");

const browser = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
});

for (const key of [
  "window",
  "document",
  "navigator",
  "Node",
  "HTMLElement",
  "MutationObserver",
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: browser.window[key],
  });
}
globalThis.getComputedStyle = browser.window.getComputedStyle.bind(
  browser.window,
);

function createDestroyedView({
  Schema,
  EditorState,
  EditorView,
  ySyncPlugin,
  prosemirrorToYDoc,
}) {
  const schema = new Schema({
    nodes: {
      doc: { content: "paragraph+" },
      paragraph: { content: "text*", toDOM: () => ["p", 0] },
      text: {},
    },
  });
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text("Shared content")]),
  ]);
  const ydoc = prosemirrorToYDoc(doc, "default");
  const plugin = ySyncPlugin(ydoc.getXmlFragment("default"));
  const view = new EditorView(document.body, {
    state: EditorState.create({ doc, plugins: [plugin] }),
  });
  const references = {
    plugin,
    view: new WeakRef(view),
    dom: new WeakRef(view.dom),
  };

  view.destroy();
  ydoc.destroy();
  return references;
}

async function main() {
  if (typeof global.gc !== "function") {
    throw new Error("This fixture requires --expose-gc");
  }

  const load =
    process.argv[2] === "import"
      ? (specifier) => import(specifier)
      : (specifier) => Promise.resolve(require(specifier));
  const [{ Schema }, { EditorState }, { EditorView }, collaboration] =
    await Promise.all([
      load("@tiptap/pm/model"),
      load("@tiptap/pm/state"),
      load("@tiptap/pm/view"),
      load("@tiptap/y-tiptap"),
    ]);
  const references = createDestroyedView({
    Schema,
    EditorState,
    EditorView,
    ...collaboration,
  });

  let viewRetained = true;
  let domRetained = true;
  for (let attempt = 0; attempt < 30; attempt++) {
    // WeakRef targets remain alive until the end of the current job.
    await delay(10);
    global.gc();
    viewRetained = references.view.deref() !== undefined;
    domRetained = references.dom.deref() !== undefined;
    if (!viewRetained && !domRetained) break;
  }

  console.log(
    JSON.stringify({
      pluginRetained: typeof references.plugin.spec.view === "function",
      viewRetained,
      domRetained,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => browser.window.close());
