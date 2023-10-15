'use client';

import { useAtom } from 'jotai';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import usePage from '@/features/page/hooks/usePage';

export default function Home() {
  const [currentUser] = useAtom(currentUserAtom);

  return (
    <>
      Hello {currentUser && currentUser.user.name}!

    </>
  );
}
