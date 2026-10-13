import type { Metadata } from "next";

import AuthForm from "../auth-form";

export const metadata: Metadata = { title: "Sign up | Trakio", description: "Create a Trakio dashboard account." };

export default function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}
