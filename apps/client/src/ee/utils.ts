import { getServerAppUrl, getSubdomainHost } from "@/lib/config.ts";

export function getHostnameUrl(hostname: string): string {
  const url = new URL(getServerAppUrl());
  const isHttps = url.protocol === "https:";

  const protocol = isHttps ? "https" : "http";
  return `${protocol}://${hostname}.${getSubdomainHost()}`;
}

export function exchangeTokenRedirectUrl(
  hostname: string,
  exchangeToken: string,
) {
  return getHostnameUrl(hostname) + "/api/auth/exchange?token=" + exchangeToken;
}
