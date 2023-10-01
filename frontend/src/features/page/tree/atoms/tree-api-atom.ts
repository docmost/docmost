import { atom } from "jotai";
import { TreeApi } from 'react-arborist';
import { Data } from "../types";

export const treeApiAtom = atom<TreeApi<Data> | null>(null);