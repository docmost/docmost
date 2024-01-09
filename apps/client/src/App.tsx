import { Route, Routes } from 'react-router-dom';
import { Welcome } from '@/pages/welcome';
import SignUpPage from '@/pages/auth/signup';
import LoginPage from '@/pages/auth/login';
import DashboardLayout from '@/components/layouts/layout';
import Home from '@/pages/dashboard/home';
import Page from '@/pages/page/page';

export default function App() {

  return (
    <>
      <Routes>
        <Route index element={<Welcome />} />
        <Route path={'/login'} element={<LoginPage />} />
        <Route path={'/signup'} element={<SignUpPage />} />

        <Route element={<DashboardLayout />}>
          <Route path={'/home'} element={<Home />} />
          <Route path={'/p/:pageId'} element={<Page />} />
        </Route>

      </Routes>
    </>
  );
}
