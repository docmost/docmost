import { createContext, useContext } from "react";
import { PagesByLabelContext } from "../pages-by-label/pages-by-label-context";

export const EditorSpaceContext = createContext<string | undefined>(undefined);

export function useEditorSpaceId() {
  const host = useContext(PagesByLabelContext);
  const editorSpaceId = useContext(EditorSpaceContext);
  return host?.spaceId ?? editorSpaceId;
}
