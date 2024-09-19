import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { Helmet } from "react-helmet-async";

export default function ForgotPassword() {
    return (
        <>
            <Helmet>
                <title>Forgot Password - Docmost</title>
            </Helmet>
            <ForgotPasswordForm />
        </>
    );
}
