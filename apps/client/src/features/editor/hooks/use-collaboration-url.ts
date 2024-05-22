import { getCollaborationUrl } from "@/lib/config.ts";

const useCollaborationURL = (): string => {
  return getCollaborationUrl();
};

export default useCollaborationURL;
