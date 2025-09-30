import { $typst } from "@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs";

let initPromise: Promise<void> | null = null;
let isInitialized = false;

const ensureInitialized = async () => {
  if (isInitialized) {
    return;
  }

  // TODO: Without online sources
  
  if (!initPromise) {
    initPromise = (async () => {
      try {
        $typst.setCompilerInitOptions({
          getModule: () =>
            "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@0.6.0/pkg/typst_ts_web_compiler_bg.wasm",
        });
        
        $typst.setRendererInitOptions({
          getModule: () =>
            "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer@0.6.0/pkg/typst_ts_renderer_bg.wasm",
        });
        
        isInitialized = true;
      } catch (error) {
        console.error("Failed to initialize Typst:", error);
        initPromise = null;
        throw error;
      }
    })();
  }

  await initPromise;
};

export const renderTypstToSvg = async (source: string) => {
  try {
    await ensureInitialized();
    if (!source.trim()) {
      return "";
    }

    return await $typst.svg({ mainContent: source });
  } catch (error) {
    console.error("Typst rendering error:", error);
    throw error;
  }
};