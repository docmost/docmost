"use client";

import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";

export default function Home() {
  const [currentUser] = useAtom(currentUserAtom);

  return (
    <div className="w-full flex justify-center z-10 flex-shrink-0">
      <div className={`w-[900px]`}>
       Hello {currentUser && currentUser.user.name}!
      </div>
    </div>
  );
}
