import {
  DATADOG_SITES,
  ISiemDestination,
  ISiemDestinationInput,
  SiemDestinationType,
} from "@/ee/siem/types/siem.types";

export type DestinationFormValues = {
  name: string;
  type: SiemDestinationType;
  url: string;
  token: string;
  apiKey: string;
  authHeaderName: string;
  authHeaderPrefix: string;
  format: "json" | "ndjson";
  index: string;
  source: string;
  sourcetype: string;
  host: string;
  site: string;
  service: string;
  tags: string;
  rejectUnauthorized: boolean;
  enabled: boolean;
};

export const DEFAULT_FORM_VALUES: DestinationFormValues = {
  name: "",
  type: "splunk_hec",
  url: "",
  token: "",
  apiKey: "",
  authHeaderName: "Authorization",
  authHeaderPrefix: "Bearer ",
  format: "json",
  index: "",
  source: "docmost",
  sourcetype: "docmost:audit",
  host: "",
  site: DATADOG_SITES[0],
  service: "docmost",
  tags: "",
  rejectUnauthorized: true,
  enabled: true,
};

const HEADER_NAME_RE = /^[A-Za-z0-9-]+$/;
export const SECRET_MASK = "********";

export function initialValues(
  destination?: ISiemDestination | null,
): DestinationFormValues {
  if (!destination) return { ...DEFAULT_FORM_VALUES };
  const config = destination.config as Record<string, any>;
  const tls = config.tls ?? {};
  return {
    ...DEFAULT_FORM_VALUES,
    name: destination.name,
    type: destination.type,
    enabled: destination.enabled,
    token: destination.hasSecrets?.token ? SECRET_MASK : "",
    apiKey: destination.hasSecrets?.apiKey ? SECRET_MASK : "",
    url: config.url ?? "",
    authHeaderName: config.authHeaderName ?? DEFAULT_FORM_VALUES.authHeaderName,
    authHeaderPrefix: config.authHeaderPrefix ?? DEFAULT_FORM_VALUES.authHeaderPrefix,
    format: config.format ?? "json",
    index: config.index ?? "",
    source: config.source ?? DEFAULT_FORM_VALUES.source,
    sourcetype: config.sourcetype ?? DEFAULT_FORM_VALUES.sourcetype,
    host: config.host ?? "",
    site: config.site ?? DEFAULT_FORM_VALUES.site,
    service: config.service ?? DEFAULT_FORM_VALUES.service,
    tags: config.tags ?? "",
    rejectUnauthorized: tls.rejectUnauthorized ?? true,
  };
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateForm(
  values: DestinationFormValues,
  hasSecrets: Record<string, boolean> = {},
): Partial<Record<keyof DestinationFormValues, string>> {
  const errors: Partial<Record<keyof DestinationFormValues, string>> = {};

  if (!values.name.trim()) errors.name = "Name is required";

  if (values.type !== "datadog" && !isValidUrl(values.url.trim())) {
    errors.url = "Enter a valid http(s) URL";
  }

  if (values.type === "splunk_hec") {
    if (!values.token && !hasSecrets.token) {
      errors.token = "HEC token is required";
    }
    try {
      const url = new URL(values.url.trim());
      const path = url.pathname.replace(/\/+$/, "");
      if (path !== "" && path !== "/services/collector" && path !== "/services/collector/event") {
        errors.url = "Enter the HEC base URL or the /services/collector/event endpoint";
      }
    } catch {}
  }

  if (values.type === "datadog") {
    if (!(DATADOG_SITES as readonly string[]).includes(values.site)) {
      errors.site = "Select a Datadog site";
    }
    if (!values.apiKey && !hasSecrets.apiKey) errors.apiKey = "API key is required";
  }

  if (values.type === "http") {
    if (!HEADER_NAME_RE.test(values.authHeaderName.trim())) {
      errors.authHeaderName = "Use letters, digits and hyphens only";
    }
  }


  return errors;
}

function enteredSecret(key: string, value: string): Record<string, string> {
  const trimmed = value.trim();
  return trimmed && trimmed !== SECRET_MASK ? { [key]: trimmed } : {};
}

export function toPayload(values: DestinationFormValues): ISiemDestinationInput {
  const tls = { rejectUnauthorized: values.rejectUnauthorized };

  let config: Record<string, unknown>;
  let secrets: Record<string, string>;

  switch (values.type) {
    case "splunk_hec":
      config = {
        url: values.url.trim(),
        index: values.index.trim(),
        source: values.source.trim() || "docmost",
        sourcetype: values.sourcetype.trim() || "docmost:audit",
        host: values.host.trim(),
        tls,
      };
      secrets = enteredSecret("token", values.token);
      break;
    case "datadog":
      config = {
        site: values.site,
        service: values.service.trim() || "docmost",
        tags: values.tags.trim(),
      };
      secrets = enteredSecret("apiKey", values.apiKey);
      break;
    default:
      config = {
        url: values.url.trim(),
        authHeaderName: values.authHeaderName.trim(),
        authHeaderPrefix: values.authHeaderPrefix,
        format: values.format,
        tls,
      };
      secrets = enteredSecret("token", values.token);
  }

  return {
    name: values.name.trim(),
    type: values.type,
    config,
    secrets: Object.fromEntries(Object.entries(secrets).filter(([, v]) => v !== "")),
    enabled: values.enabled,
  };
}
