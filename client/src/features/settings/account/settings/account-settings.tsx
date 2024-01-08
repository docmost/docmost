import React from "react";
import AccountNameForm from '@/features/settings/account/settings/components/account-name-form';
import ChangeEmail from '@/features/settings/account/settings/components/change-email';
import ChangePassword from '@/features/settings/account/settings/components/change-password';
import { Divider } from '@mantine/core';
import AccountAvatar from '@/features/settings/account/settings/components/account-avatar';

export default function AccountSettings() {

  return (
    <>

      <AccountAvatar />

      <AccountNameForm />

      <Divider my="lg" />

      <ChangeEmail />

      <Divider my="lg" />

      <ChangePassword />
    </>);
}
