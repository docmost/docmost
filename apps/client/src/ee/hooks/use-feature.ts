import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom";

export const useHasFeature = (feature: string): boolean => {
  const [workspace] = useAtom(workspaceAtom);
  return workspace?.features?.includes(feature) ?? false;
};

export const useHasAnyFeature = (): boolean => {
  const [workspace] = useAtom(workspaceAtom);
  return (workspace?.features?.length ?? 0) > 0;
};
