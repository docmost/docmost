import { useAtom } from 'jotai';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import { Container } from '@mantine/core';
import HomeTabs from '@/features/home/components/home-tabs';

//        Hello {currentUser && currentUser.user.name}!
export default function Home() {
  const [currentUser] = useAtom(currentUserAtom);

  return (
    <Container size={'800'} pt="xl">

      <HomeTabs/>

    </Container>
  );
}
