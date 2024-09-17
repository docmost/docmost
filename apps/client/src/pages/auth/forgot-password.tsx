import { Helmet } from "react-helmet-async";
import {ForgotPasswordForm} from "@/features/auth/components/forgot-password-form.tsx";

export default function ForgotPassword() {
    return (
        <>
            <Helmet>
                <title>Forgot Password</title>
            </Helmet>
            <ForgotPasswordForm />
        </>
    );
}
