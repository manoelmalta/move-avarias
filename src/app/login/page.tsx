import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entrar — MOVE AVARIAS" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="fixed inset-0 z-50 bg-muted/60 flex items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}
