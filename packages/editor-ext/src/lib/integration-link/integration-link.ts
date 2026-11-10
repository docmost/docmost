import { isHttpUrl, sanitizeUrl } from "../utils";

// Only web urls survive, kept as given because sanitizeUrl decodes percent-escapes.
export function sanitizeIntegrationUrl(url: string | null | undefined): string {
  const trimmed = url?.trim() ?? "";
  return isHttpUrl(trimmed) && isHttpUrl(sanitizeUrl(trimmed)) ? trimmed : "";
}

export interface IntegrationLinkOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface IntegrationLinkAttributes {
  url: string;
  provider: string;
}
