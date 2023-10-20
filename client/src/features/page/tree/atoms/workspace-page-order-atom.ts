import { atomWithStorage } from "jotai/utils";
import { IWorkspacePageOrder } from '@/features/page/types/page.types';

export const workspacePageOrderAtom = atomWithStorage<IWorkspacePageOrder | null>("workspace-page-order", null);
