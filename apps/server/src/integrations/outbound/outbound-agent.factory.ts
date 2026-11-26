import { Injectable } from '@nestjs/common';
import { Agent, Dispatcher } from 'undici';
import { createEnvProxyAgent, hasProxyEnv } from '../../common/proxy-fetch';
import {
  OutboundUrlGuard,
  OutboundValidateOptions,
} from './outbound-url.guard';

export const OUTBOUND_REQUEST_TIMEOUT_MS = 10_000;

export type OutboundTlsOptions = {
  caCert?: string; // PEM encoded
  rejectUnauthorized?: boolean; // Defaults to true; self-hosted only when false.
};

export type AgentLease = {
  dispatcher: Dispatcher;
  release: () => Promise<void>;
};

export type OutboundLeaseOptions = OutboundValidateOptions & {
  viaProxy?: boolean; // Uses HTTP(S)_PROXY when set; hosts it skips still connect to the pinned address.
};

export type IOutboundAgentFactory = {
  lease(
    url: string,
    tls?: OutboundTlsOptions,
    options?: OutboundLeaseOptions,
  ): Promise<AgentLease>;
};

/** Creates a per-request agent pinned to the address validated by the SSRF guard. */
@Injectable()
export class OutboundAgentFactory implements IOutboundAgentFactory {
  constructor(private readonly urlGuard: OutboundUrlGuard) {}

  async lease(
    url: string,
    tls?: OutboundTlsOptions,
    leaseOptions?: OutboundLeaseOptions,
  ): Promise<AgentLease> {
    const pinned = await this.urlGuard.validate(url, {
      publicOnly: leaseOptions?.publicOnly,
    });

    const lookup = (_hostname: string, options: any, callback: any) => {
      if (options?.all) {
        callback(null, [{ address: pinned.address, family: pinned.family }]);
      } else {
        callback(null, pinned.address, pinned.family);
      }
    };

    const agentOptions: Agent.Options = {
      connect: {
        ca: tls?.caCert || undefined,
        rejectUnauthorized: tls?.rejectUnauthorized ?? true,
        lookup: lookup as any,
        timeout: OUTBOUND_REQUEST_TIMEOUT_MS,
      },
      headersTimeout: OUTBOUND_REQUEST_TIMEOUT_MS,
      bodyTimeout: OUTBOUND_REQUEST_TIMEOUT_MS,
    };
    const agent =
      leaseOptions?.viaProxy && hasProxyEnv()
        ? createEnvProxyAgent(agentOptions)
        : new Agent(agentOptions);

    return {
      dispatcher: agent,
      release: async () => {
        await agent.close();
      },
    };
  }
}
