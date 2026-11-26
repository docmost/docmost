import { EnvHttpProxyAgent, fetch as undiciFetch } from 'undici';

const LOOPBACK_BYPASS = ['localhost', '127.0.0.1', '::1'];

let cachedAgent: EnvHttpProxyAgent | undefined;

export function hasProxyEnv(): boolean {
  return Boolean(
    process.env.HTTP_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.http_proxy ||
      process.env.https_proxy,
  );
}

export function createEnvProxyAgent(
  options: EnvHttpProxyAgent.Options = {},
): EnvHttpProxyAgent {
  const existing = process.env.NO_PROXY || process.env.no_proxy || '';
  const merged = [existing, ...LOOPBACK_BYPASS]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(',');
  return new EnvHttpProxyAgent({ ...options, noProxy: merged });
}

export function getProxyAwareFetch(): typeof fetch | undefined {
  if (!hasProxyEnv()) return undefined;
  cachedAgent ??= createEnvProxyAgent();
  const agent = cachedAgent;
  return ((input, init) =>
    undiciFetch(input as any, {
      ...(init as any),
      dispatcher: agent,
    }) as unknown as Promise<Response>) as typeof fetch;
}

export const proxyFetch: typeof fetch = (input, init) =>
  (getProxyAwareFetch() ?? fetch)(input, init);
