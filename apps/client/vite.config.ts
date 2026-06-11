import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";

const envPath = path.resolve(process.cwd(), "..", "..");

export default defineConfig(({ mode }) => {
  const {
    APP_URL,
    BACKEND_URL,
    FILE_UPLOAD_SIZE_LIMIT,
    FILE_IMPORT_SIZE_LIMIT,
    DRAWIO_URL,
    CLOUD,
    SUBDOMAIN_HOST,
    COLLAB_URL,
    BILLING_TRIAL_DAYS,
    POSTHOG_HOST,
    POSTHOG_KEY,
  } = loadEnv(mode, envPath, "");

  return {
    define: {
      "process.env": {
        APP_URL,
        FILE_UPLOAD_SIZE_LIMIT,
        FILE_IMPORT_SIZE_LIMIT,
        DRAWIO_URL,
        CLOUD,
        SUBDOMAIN_HOST,
        COLLAB_URL,
        BILLING_TRIAL_DAYS,
        POSTHOG_HOST,
        POSTHOG_KEY,
      },
      APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    plugins: [react()],
    build: {
      rolldownOptions: {
        output: {
          advancedChunks: {
            groups: [
              {
                name: "vendor-mantine",
                test: /[\\/]node_modules[\\/]@mantine[\\/]/,
              },
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    server: {
      proxy: {
        // Falls back to APP_URL when BACKEND_URL isn't set so the upstream
        // single-port dev workflow keeps working unchanged. Set BACKEND_URL
        // explicitly when APP_URL points at the dev server's public origin
        // (e.g. for OAuth-style flows that round-trip through the browser).
        "/api": {
          target: BACKEND_URL || APP_URL,
          changeOrigin: false,
        },
        "/socket.io": {
          target: BACKEND_URL || APP_URL,
          ws: true,
          rewriteWsOrigin: true,
        },
        "/collab": {
          target: BACKEND_URL || APP_URL,
          ws: true,
          rewriteWsOrigin: true,
        },
      },
    },
  };
});
