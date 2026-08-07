import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { getAppName } from "@/lib/config";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";


export default function ForgotPassword() {
    const { t } = useTranslation();
    return (
        <>
            <Helmet>
                <title>
                    {`${t("Forgot Password")}`}
                </title>
            </Helmet>
            <ForgotPasswordForm />
        </>
    );
}
