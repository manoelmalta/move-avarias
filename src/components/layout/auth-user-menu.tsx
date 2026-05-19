import { auth } from "@/auth";
import { AuthUserMenuClient } from "./auth-user-menu-client";
import type { UserRole } from "@/lib/auth/types";

/**
 * Server Component — lê a sessão e passa os dados para o Client Component.
 * O estado do dialog de alteração de senha é gerenciado no lado cliente.
 */
export async function AuthUserMenu() {
  const session = await auth();
  if (!session?.user) return null;

  const { name, email, role } = session.user;

  return (
    <AuthUserMenuClient
      name={name}
      email={email}
      role={role as UserRole}
    />
  );
}
