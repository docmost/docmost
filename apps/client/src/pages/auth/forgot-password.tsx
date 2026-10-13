import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { DocumentTitle } from "@/components/ui/document-title.tsx";

export default function ForgotPassword() {
    return (
        <>
            <DocumentTitle title="Forgot Password" />
            <ForgotPasswordForm />
        </>
    );
}
