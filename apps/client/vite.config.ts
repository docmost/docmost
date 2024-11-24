import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";

export const envPath = path.resolve(process.cwd(), "..", "..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envPath, "");
  const { APP_URL, FILE_UPLOAD_SIZE_LIMIT, VITE_MISTRAL_API_KEY } = env;

  return {
    define: {
      "process.env": {
        APP_URL,
        FILE_UPLOAD_SIZE_LIMIT,
        VITE_MISTRAL_API_KEY
      },
      'APP_VERSION': JSON.stringify(process.env.npm_package_version),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    server: {
      proxy: {
        "/api": {
          target: APP_URL,
          changeOrigin: true,
        },
      },
    },
  };
});
