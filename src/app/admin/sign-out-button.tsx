"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const [working, setWorking] = useState(false);
  const router = useRouter();

  async function signOut() {
    setWorking(true);
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/auth/sign-in");
    router.refresh();
  }

  return <button type="button" onClick={signOut} disabled={working} className="min-h-11 border-2 border-[#D02020] bg-[#FFFFFF] px-4 py-2 text-sm font-bold text-[#D02020] shadow-[3px_3px_0_#121212] hover:bg-[#D02020] hover:text-[#FFFFFF] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D02020]">{working ? "Signing out" : "Sign out"}</button>;
}
