import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { getAppName } from "@/lib/config";
import { Helmet } from "react-helmet-async";

export default function ForgotPassword() {
    return (
        <>
            <Helmet>
                <title>Forgot Password - {getAppName()}</title>
            </Helmet>
            <ForgotPasswordForm />
        </>
    );
}
