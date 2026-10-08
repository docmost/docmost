import { IncomingHttpHeaders } from 'node:http2';
import RedisClient from 'ioredis';
import { CollabProxySocket } from './collab-proxy-socket';
import { type Hocuspocus, type WebSocketLike } from '@hocuspocus/server';

export type SecondParam<T> = T extends (
  arg1: any,
  arg2: infer A,
  ...args: any[]
) => any
  ? A
  : never;

export type SerializedHTTPRequest = {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  socket: { remoteAddress: string };
};

export type RSAMessageProxy = {
  type: 'proxy';
  replyTo: string;
  message: Uint8Array<ArrayBufferLike>;
  serializedHTTPRequest: SerializedHTTPRequest;
};

export type RSAMessageCloseProxy = {
  type: 'closeProxy';
  socketId: string;
};

export type RSAMessageUnload = {
  type: 'unload';
  documentName: string;
};

export type RSAMessageClose = {
  type: 'close';
  code?: number;
  reason?: string;
  socketId: string;
};

export type RSAMessageSend = {
  type: 'send';
  // @ts-ignore
  message: Uint8Array<ArrayBufferLike>;
  socketId: string;
};

export type RSAMessageCustomEventStart<TName = string, TPayload = any> = {
  type: 'customEventStart';
  documentName: string;
  eventName: TName;
  payload: TPayload;
  replyTo: string;
  replyId: number;
};

export type RSAMessageCustomEventComplete = {
  type: 'customEventComplete';
  replyId: number;
  payload: any;
};

export type RSAMessage =
  | RSAMessageProxy
  | RSAMessageCloseProxy
  | RSAMessageUnload
  | RSAMessageClose
  | RSAMessageSend
  | RSAMessageCustomEventStart
  | RSAMessageCustomEventComplete;

// @ts-ignore
export type Pack = (msg: RSAMessage) => string | Buffer<ArrayBufferLike>;

export type Unpack = (
  // @ts-ignore
  packedMessage: Uint8Array | Buffer<ArrayBufferLike>,
) => RSAMessage;

type ServerId = string;
type DocumentName = string;
type CustomEventName = string;

export type CustomEvents = Record<
  CustomEventName,
  (documentName: string, payload: any) => Promise<any>
>;

// Not exported by @hocuspocus/server
export type ClientConnection = ReturnType<Hocuspocus['handleConnection']>;
export type OriginConnection = {
  clientConnection: ClientConnection;
  socket: WebSocketLike;
};
export type ProxyConnection = {
  clientConnection: ClientConnection;
  socket: CollabProxySocket;
};

export interface Configuration<TCE> {
  redis: RedisClient;
  pack: Pack;
  unpack: Unpack;
  serverId: ServerId;
  lockTTL?: number;
  customEventTTL?: number;
  prefix?: string;
  customEvents?: TCE;
  // Derive the hocuspocus context once per socket instead of re-deriving it in a
  // per-document hook like onConnect/onAuthenticate. Runs on the origin server when
  // the socket opens and on the doc owner when the first proxied message arrives.
  deriveContext?: (
    serializedHTTPRequest: SerializedHTTPRequest,
  ) => Record<string, any>;
}

// Hocuspocus expects a web-standard Request, so rehydrate one from what crossed the wire
export const toWebRequest = (serializedHTTPRequest: SerializedHTTPRequest) => {
  const { method, url, headers } = serializedHTTPRequest;
  const webHeaders = new Headers();
  Object.entries(headers).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        webHeaders.append(name, v);
      });
    } else if (value !== undefined) {
      webHeaders.set(name, value);
    }
  });
  return new Request(new URL(url, 'http://localhost'), {
    method,
    headers: webHeaders,
  });
};
