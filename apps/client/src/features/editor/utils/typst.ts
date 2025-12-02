import { $typst } from "@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs";

import compilerWasmUrl from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";
import rendererWasmUrl from "@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url";

let initPromise: Promise<void> | null = null;
let isInitialized = false;

const ensureInitialized = async () => {
  if (isInitialized) {
    return;
  }
  
  if (!initPromise) {
    initPromise = (async () => {
      try {
        $typst.setCompilerInitOptions({
          getModule: () => compilerWasmUrl,
        });
        
        $typst.setRendererInitOptions({
          getModule: () => rendererWasmUrl,
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