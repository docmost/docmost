import React, {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  HocuspocusProvider,
  onAuthenticationFailedParameters,
  onStatelessParameters,
} from "@hocuspocus/provider";
import {
  HocuspocusContext,
  HocuspocusRoomContext,
} from "@hocuspocus/provider-react";

type CollabRoomProps = {
  name: string;
  token: string;
  flushDelay?: number;
  onStateless?: (data: onStatelessParameters) => void;
  onAuthenticationFailed?: (data: onAuthenticationFailedParameters) => void;
  children: React.ReactNode;
};

/**
 * Replaces the library HocuspocusRoom, whose unmount defers provider.destroy()
 * by a timeout (a StrictMode grace we don't need): a room for the same
 * document mounting in the same commit then attaches while the old provider is
 * still registered on the shared socket and crashes with "Cannot attach two
 * providers with the same effective name". Destroying synchronously preserves
 * unmount-before-mount ordering, and attach evicts whatever a previously
 * interrupted teardown left registered.
 */
export default function CollabRoom({
  name,
  token,
  flushDelay,
  onStateless,
  onAuthenticationFailed,
  children,
}: CollabRoomProps) {
  const context = useContext(HocuspocusContext);
  if (!context) {
    throw new Error(
      "CollabRoom must be used within HocuspocusProviderWebsocketComponent",
    );
  }
  const { websocketProvider } = context;

  const [provider, setProvider] = useState(
    () =>
      new HocuspocusProvider({ name, websocketProvider, token, flushDelay }),
  );

  useEffect(() => {
    if (
      provider.configuration.name !== name ||
      provider.configuration.token !== token ||
      provider.configuration.websocketProvider !== websocketProvider
    ) {
      provider.destroy();
      setProvider(
        new HocuspocusProvider({ name, websocketProvider, token, flushDelay }),
      );
    }
  }, [name, token, websocketProvider]);

  useEffect(() => {
    const providerMap = websocketProvider.configuration.providerMap;
    const existing = providerMap.get(provider.effectiveName);
    if (existing && existing !== provider) {
      try {
        existing.destroy();
      } catch {
        // a broken teardown is exactly why it leaked; the delete below recovers
      }
      providerMap.delete(provider.effectiveName);
    }
    provider.attach();
    return () => provider.destroy();
  }, [provider]);

  const handlersRef = useRef({ onStateless, onAuthenticationFailed });
  handlersRef.current = { onStateless, onAuthenticationFailed };

  useEffect(() => {
    const statelessListener = (data: onStatelessParameters) =>
      handlersRef.current.onStateless?.(data);
    const authenticationFailedListener = (
      data: onAuthenticationFailedParameters,
    ) => handlersRef.current.onAuthenticationFailed?.(data);
    provider.on("stateless", statelessListener);
    provider.on("authenticationFailed", authenticationFailedListener);
    return () => {
      provider.off("stateless", statelessListener);
      provider.off("authenticationFailed", authenticationFailedListener);
    };
  }, [provider]);

  const contextValue = useMemo(() => ({ provider }), [provider]);

  return (
    <HocuspocusRoomContext.Provider value={contextValue}>
      {children}
    </HocuspocusRoomContext.Provider>
  );
}
