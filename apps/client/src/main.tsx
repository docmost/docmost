import "@mantine/core/styles.css";
import "@mantine/spotlight/styles.css";
import "@mantine/notifications/styles.css";
import '@mantine/dates/styles.css';
import "./styles/ui-refresh.css";

import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import App from "./App.tsx";
import { mantineCssResolver, theme } from "@/theme";
import { MantineProvider } from "@mantine/core";
import { BrowserRouter } from "react-router-dom";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import "./i18n";
import { PostHogProvider } from "posthog-js/react";
import {
  getPostHogHost,
  getPostHogKey,
  isCloud,
  isPostHogEnabled,
} from "@/lib/config.ts";
import posthog from "posthog-js";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

try {
  if (isCloud() && isPostHogEnabled && getPostHogKey() && getPostHogHost()) {
    posthog.init(getPostHogKey(), {
      api_host: getPostHogHost(),
      defaults: "2025-05-24",
      disable_session_recording: true,
      capture_pageleave: false,
    });
  }
} catch {
  // ignore posthog init errors to avoid white screen
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

const root = ReactDOM.createRoot(rootEl);

function AppErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: 24,
        background: "#f6f7f9",
        color: "#495057",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <p style={{ marginBottom: 16 }}>页面加载出错</p>
      <button
        type="button"
        onClick={() => {
          resetErrorBoundary();
          window.location.href = "/";
        }}
        style={{
          padding: "8px 16px",
          cursor: "pointer",
          background: "#228be6",
          color: "#fff",
          border: "none",
          borderRadius: 4,
        }}
      >
        重新加载
      </button>
    </div>
  );
}

root.render(
  <BrowserRouter>
    <MantineProvider theme={theme} cssVariablesResolver={mantineCssResolver}>
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>
          <Notifications position="bottom-center" limit={3} zIndex={10000} />
          <HelmetProvider>
            <PostHogProvider client={posthog}>
              <ErrorBoundary
                FallbackComponent={AppErrorFallback}
                onReset={() => {}}
              >
                <App />
              </ErrorBoundary>
            </PostHogProvider>
          </HelmetProvider>
        </QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>
  </BrowserRouter>,
);
