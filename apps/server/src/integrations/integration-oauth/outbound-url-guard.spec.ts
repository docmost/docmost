import {
  allowLocalConnections,
  integrationMaxResponseBytes,
  integrationRequestTimeoutMs,
  isBlockedOutboundAddress,
  OutboundResponse,
  OutboundResponseTooLargeError,
  readOutboundBody,
} from './outbound-url-guard';

function streamResponse(
  chunks: string[],
  headers: Record<string, string> = {},
): OutboundResponse {
  const encoder = new TextEncoder();
  const queue = [...chunks];
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = queue.shift();
      if (next === undefined) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(next));
    },
  });
  return {
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    body,
  } as unknown as OutboundResponse;
}

describe('outbound-url-guard', () => {
  describe('allowLocalConnections', () => {
    const original = process.env.INTEGRATION_ALLOW_LOCAL_CONNECTIONS;

    afterEach(() => {
      if (original === undefined) {
        delete process.env.INTEGRATION_ALLOW_LOCAL_CONNECTIONS;
      } else {
        process.env.INTEGRATION_ALLOW_LOCAL_CONNECTIONS = original;
      }
    });

    it('defaults to allowing local connections (guard off)', () => {
      delete process.env.INTEGRATION_ALLOW_LOCAL_CONNECTIONS;
      expect(allowLocalConnections()).toBe(true);
    });

    it('only the explicit string "false" enables the guard', () => {
      process.env.INTEGRATION_ALLOW_LOCAL_CONNECTIONS = 'false';
      expect(allowLocalConnections()).toBe(false);
      process.env.INTEGRATION_ALLOW_LOCAL_CONNECTIONS = 'true';
      expect(allowLocalConnections()).toBe(true);
    });
  });

  describe('isBlockedOutboundAddress', () => {
    const blocked = [
      '127.0.0.1', // loopback
      '127.8.8.8', // loopback /8
      '0.0.0.0', // unspecified
      '169.254.169.254', // link-local / cloud metadata
      '10.1.2.3', // RFC1918
      '172.16.0.1', // RFC1918
      '172.31.255.255', // RFC1918 upper edge
      '192.168.1.1', // RFC1918
      '100.64.0.1', // CGNAT
      '224.0.0.1', // multicast
      '255.255.255.255', // broadcast
      '::1', // v6 loopback
      '::', // v6 unspecified
      'fe80::1', // v6 link-local
      'fc00::1', // v6 unique-local
      'fd12:3456::1', // v6 unique-local /7
      'ff02::1', // v6 multicast
      '::ffff:127.0.0.1', // v4-mapped loopback
      '::ffff:10.0.0.1', // v4-mapped RFC1918
      '2002:7f00:0001::', // 6to4-embedded 127.0.0.1
      '64:ff9b::a00:1', // NAT64-embedded 10.0.0.1
      'not-an-ip', // unparseable → fail closed
    ];

    const allowed = [
      '8.8.8.8',
      '1.1.1.1',
      '93.184.216.34',
      '172.32.0.1', // just past RFC1918 172.16/12
      '100.128.0.1', // just past CGNAT /10
      '2606:4700::1111',
      '2002:0808:0808::', // 6to4-embedded 8.8.8.8
      '64:ff9b::808:808', // NAT64-embedded 8.8.8.8
    ];

    it.each(blocked)('blocks %s', (address) => {
      expect(isBlockedOutboundAddress(address)).toBe(true);
    });

    it.each(allowed)('allows %s', (address) => {
      expect(isBlockedOutboundAddress(address)).toBe(false);
    });
  });

  describe('egress limits configuration', () => {
    afterEach(() => {
      delete process.env.INTEGRATION_REQUEST_TIMEOUT_MS;
      delete process.env.INTEGRATION_MAX_RESPONSE_BYTES;
    });

    it('uses safe defaults', () => {
      expect(integrationRequestTimeoutMs()).toBe(15_000);
      expect(integrationMaxResponseBytes()).toBe(5 * 1024 * 1024);
    });

    it('honors env overrides and rejects nonsense values', () => {
      process.env.INTEGRATION_REQUEST_TIMEOUT_MS = '3000';
      process.env.INTEGRATION_MAX_RESPONSE_BYTES = '1024';
      expect(integrationRequestTimeoutMs()).toBe(3000);
      expect(integrationMaxResponseBytes()).toBe(1024);

      process.env.INTEGRATION_REQUEST_TIMEOUT_MS = '-1';
      process.env.INTEGRATION_MAX_RESPONSE_BYTES = 'lots';
      expect(integrationRequestTimeoutMs()).toBe(15_000);
      expect(integrationMaxResponseBytes()).toBe(5 * 1024 * 1024);
    });
  });

  describe('readOutboundBody', () => {
    it('reads multi-chunk bodies under the limit', async () => {
      const resp = streamResponse(['{"a":', '1}']);
      await expect(readOutboundBody(resp, 1024)).resolves.toBe('{"a":1}');
    });

    it('fails fast on a Content-Length above the limit', async () => {
      const resp = streamResponse(['x'], { 'content-length': '2048' });
      await expect(readOutboundBody(resp, 1024)).rejects.toBeInstanceOf(
        OutboundResponseTooLargeError,
      );
    });

    it('aborts a stream that exceeds the limit despite its headers', async () => {
      const resp = streamResponse(
        ['a'.repeat(600), 'b'.repeat(600), 'c'.repeat(600)],
        { 'content-length': '10' },
      );
      await expect(readOutboundBody(resp, 1024)).rejects.toBeInstanceOf(
        OutboundResponseTooLargeError,
      );
    });

    it('returns an empty string for bodyless responses', async () => {
      const resp = {
        headers: { get: () => null },
        body: null,
      } as unknown as OutboundResponse;
      await expect(readOutboundBody(resp, 1024)).resolves.toBe('');
    });
  });
});
