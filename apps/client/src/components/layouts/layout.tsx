import { UserProvider } from '@/features/user/user-provider';
import Shell from './shell';
import { Outlet } from 'react-router-dom';

export default function DashboardLayout() {

  return (
    <UserProvider>
      <Shell>
        <Outlet />
      </Shell>
    </UserProvider>
  );
}
