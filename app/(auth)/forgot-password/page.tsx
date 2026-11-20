import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Get a link to choose a new FitTracker password.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
