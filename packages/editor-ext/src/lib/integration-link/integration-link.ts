import { sanitizeHttpUrl } from "../utils";

export const sanitizeIntegrationUrl = sanitizeHttpUrl;

export interface IntegrationLinkOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface IntegrationLinkAttributes {
  url: string;
  provider: string;
}
