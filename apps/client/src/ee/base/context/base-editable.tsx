import { createContext, useContext, type ReactNode } from "react";

const BaseEditableContext = createContext<boolean>(true);

export function BaseEditableProvider({
  editable,
  children,
}: {
  editable: boolean;
  children: ReactNode;
}) {
  return (
    <BaseEditableContext.Provider value={editable}>
      {children}
    </BaseEditableContext.Provider>
  );
}

/** Whether the current base subtree is editable. Defaults to true outside a provider. */
export function useBaseEditable(): boolean {
  return useContext(BaseEditableContext);
}
