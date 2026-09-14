export const SIEM_MAX_DESTINATIONS_PER_WORKSPACE = 2;

export type SiemDestinationType = "http" | "splunk_hec" | "datadog";
export type SiemDestinationStatus = "healthy" | "failing";

export const DATADOG_SITES = [
  "datadoghq.com",
  "datadoghq.eu",
  "us3.datadoghq.com",
  "us5.datadoghq.com",
  "ap1.datadoghq.com",
  "ddog-gov.com",
] as const;

export interface ITlsOptions {
  rejectUnauthorized: boolean;
}

export interface IHttpConfig {
  url: string;
  authHeaderName: string;
  authHeaderPrefix: string;
  format: "json" | "ndjson";
  tls?: ITlsOptions;
}

export interface ISplunkHecConfig {
  url: string;
  index?: string;
  source: string;
  sourcetype: string;
  host?: string;
  channelId: string;
  tls?: ITlsOptions;
}

export interface IDatadogConfig {
  site: string;
  service: string;
  tags?: string;
}

export type ISiemConfig = IHttpConfig | ISplunkHecConfig | IDatadogConfig;

export interface ISiemDestination {
  id: string;
  name: string;
  type: SiemDestinationType;
  enabled: boolean;
  status: SiemDestinationStatus;
  config: ISiemConfig;
  hasSecrets: Record<string, boolean>;
  cursorCreatedAt: string;
  lastDeliveredAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  consecutiveFailures: number;
  nextAttemptAt: string | null;
  failingSince: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ISiemDestinationInput {
  name: string;
  type: SiemDestinationType;
  config: Record<string, unknown>;
  secrets?: Record<string, string>;
  enabled?: boolean;
}

export interface IUpdateSiemDestinationInput {
  destinationId: string;
  name?: string;
  config?: Record<string, unknown>;
  secrets?: Record<string, string>;
  enabled?: boolean;
}

export interface ITestSiemDestinationInput {
  type: SiemDestinationType;
  config: Record<string, unknown>;
  secrets?: Record<string, string>;
  destinationId?: string;
}

export interface ISiemTestResult {
  delivered: boolean;
  error?: string;
  statusCode?: number;
}
