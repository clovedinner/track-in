import type { Metadata } from "next";

import AuthForm from "../auth-form";

export const metadata: Metadata = { title: "Sign in | Trakio", description: "Sign in to the Trakio dashboard." };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ verified?: string; verification?: string }> }) {
  const query = await searchParams;
  return <AuthForm mode="sign-in" verified={query.verified === "1"} verificationIssue={query.verification === "invalid"} />;
}
