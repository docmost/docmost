import { atom } from "jotai";
import { SpaceTreeNode } from "@/features/page/tree/types";

// Separate atom for favorite tree data — not shared with the main space tree.
// Lives in its own module (mirroring treeDataAtom) so hooks/effects that need
// to keep both trees in sync (e.g. use-tree-socket.ts) can import it without
// depending on the FavoriteSpaceTree component itself.
export const favTreeDataAtom = atom<SpaceTreeNode[]>([]);
