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

export type RetentionUnit = "days" | "months" | "years";

export function daysToRetention(days: number): { amount: number; unit: RetentionUnit } {
  if (days >= 365 && days % 365 === 0) {
    return { amount: days / 365, unit: "years" };
  }
  if (days >= 30 && days % 30 === 0) {
    return { amount: days / 30, unit: "months" };
  }
  return { amount: days, unit: "days" };
}

export function retentionToDays(amount: number, unit: RetentionUnit): number {
  if (unit === "years") return amount * 365;
  if (unit === "months") return amount * 30;
  return amount;
}

export function toISODate(daysAgo: number | string): string {
  const daysNum = Number(daysAgo);

  return new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function formatNumber(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString();
}