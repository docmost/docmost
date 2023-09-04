'use client';

import AccountNameForm from '@/features/user/components/account-name-form';
import ChangePassword from "@/features/user/components/change-password";
import ChangeEmail from "@/features/user/components/change-email";
import { Separator } from "@/components/ui/separator";
import React from "react";

export default function Home() {

  return (
    <>
      <AccountNameForm />

      <Separator className="my-4" />

      <ChangeEmail />

      <Separator className="my-4" />

      <ChangePassword />
    </>);
}
