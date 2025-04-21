import { atom } from "jotai";
import { Socket } from "socket.io-client";

export const socketAtom = atom<Socket | null>(null);
