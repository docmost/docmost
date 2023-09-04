'use client';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAtom } from 'jotai';
import { focusAtom } from 'jotai-optics';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { currentUserAtom } from '../atoms/current-user-atom';
import { updateUser } from '../services/user-service';
import { IUser } from '../types/user.types';
import { useState } from 'react';
import { Icons } from '@/components/icons';
import toast from "react-hot-toast";

const profileFormSchema = z.object({
  name: z.string().min(2).max(40),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const userAtom = focusAtom(currentUserAtom, (optic) => optic.prop('user'));

export default function AccountNameForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser] = useAtom(currentUserAtom);
  const [, setUser] = useAtom(userAtom);

  const defaultValues: Partial<ProfileFormValues> = {
    name: currentUser?.user?.name,
  };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
  });

  async function onSubmit(data: Partial<IUser>) {
    setIsLoading(true);

    try {
      const updatedUser = await updateUser(data);
      setUser(updatedUser);
      toast.success('Updated successfully');
    } catch (err) {
      console.log(err);
      toast.error('Failed to update data.')
    }

    setIsLoading(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Your name" {...field} />
              </FormControl>
              <FormDescription>
                This is the name that will be displayed on your account and in
                emails.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading}>
          {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </form>
    </Form>
  );
}
