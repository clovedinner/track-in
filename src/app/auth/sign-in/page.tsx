import type { Metadata } from "next";

import AuthForm from "../auth-form";

export const metadata: Metadata = { title: "Sign in | Trakio", description: "Sign in to the Trakio dashboard." };

export default function SignInPage() {
  return <AuthForm mode="sign-in" />;
}
