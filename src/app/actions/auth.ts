"use server";
import { signOut } from "@/auth";

/**
 * Server action que executa o logout e redireciona para /login.
 * Exportada para uso em Client Components (ex.: AuthUserMenuClient).
 */
export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
