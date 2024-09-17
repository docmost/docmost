import * as React from "react";
import {useState} from "react";
import * as z from "zod";
import {useForm, zodResolver} from "@mantine/form";
import useAuth from "@/features/auth/hooks/use-auth";
import {IForgotPassword} from "@/features/auth/types/auth.types";
import {Box, Button, Container, PasswordInput, TextInput, Title,} from "@mantine/core";
import classes from "./auth.module.css";
import {useRedirectIfAuthenticated} from "@/features/auth/hooks/use-redirect-if-authenticated.ts";
import {notifications} from "@mantine/notifications";

const stepOneSchema = z.object({
    email: z
        .string()
        .min(1, {message: "Email is required"})
        .email({message: "Invalid email address"}),
});

const stepTwoSchema = z.object({
    email: z
        .string()
        .min(1, {message: "Email is required"})
        .email({message: "Invalid email address"}),
    token: z.string().min(1, {message: 'Token is required'}),
    newPassword: z.string().min(8, {message: 'Password must contain at least 8 character(s)'}),
});

export function ForgotPasswordForm() {
    const {forgotPassword, isLoading} = useAuth();
    const [isTokenSend, setIsTokenSend] = useState<boolean>(false)
    useRedirectIfAuthenticated();

    const form = useForm<IForgotPassword>({
        validate: isTokenSend ? zodResolver(stepTwoSchema) : zodResolver(stepOneSchema),
        initialValues: {
            email: "",
            token: null,
            newPassword: null,
        },
    });

    async function onSubmit(data: IForgotPassword) {
        const success = await forgotPassword(data);

        if (success) {
            if (isTokenSend) {
                notifications.show({
                    message: 'Password updated',
                    color: "green",
                });
            }

            if (!isTokenSend) {
                setIsTokenSend(true);
            }
        }
    }

    return (
        <Container size={420} my={40} className={classes.container}>
            <Box p="xl" mt={200}>
                <Title order={2} ta="center" fw={500} mb="md">
                    Forgot password
                </Title>

                <form onSubmit={form.onSubmit(onSubmit)}>
                    <TextInput
                        id="email"
                        type="email"
                        label="Email"
                        placeholder="email@example.com"
                        variant="filled"
                        disabled={isTokenSend}
                        {...form.getInputProps("email")}
                    />

                    {
                        isTokenSend
                        && (
                            <>
                                <TextInput
                                    id="token"
                                    className={classes.formElemWithTopMargin}
                                    type="text"
                                    label="Token"
                                    placeholder="token"
                                    variant="filled"
                                    {...form.getInputProps("token")}
                                />

                                <PasswordInput
                                    label="Password"
                                    placeholder="Your password"
                                    variant="filled"
                                    mt="md"
                                    {...form.getInputProps("newPassword")}
                                />
                            </>
                        )
                    }

                    <Button type="submit" fullWidth mt="xl" loading={isLoading}>
                        {isTokenSend ? 'Set password' : 'Send Token'}
                    </Button>
                </form>
            </Box>
        </Container>
    );
}
