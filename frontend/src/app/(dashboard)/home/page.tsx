"use client";

import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";

export default function Home() {
  const [currentUser] = useAtom(currentUserAtom);

  return (
    <>
      Hello {currentUser && currentUser.user.name}!
    </>
  );
}
