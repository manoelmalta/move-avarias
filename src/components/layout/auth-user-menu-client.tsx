"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordDialog } from "@/components/account/change-password-dialog";
import { signOutAction } from "@/app/actions/auth";
import type { UserRole } from "@/lib/auth/types";

const roleVariants: Record<
  UserRole,
  "default" | "secondary" | "success" | "warning" | "info" | "destructive"
> = {
  ADMIN: "destructive",
  GESTOR: "default",
  ANALISTA: "info",
  LIDER: "warning",
  SEPARADOR: "secondary",
};

interface AuthUserMenuClientProps {
  name: string;
  email: string;
  role: UserRole;
}

/**
 * Client Component — gerencia o estado do dialog de alteração de senha
 * e recebe dados de sessão como props do Server Component pai (AuthUserMenu).
 * Todos os perfis logados têm acesso — não requer permissão especial.
 */
export function AuthUserMenuClient({ name, email, role }: AuthUserMenuClientProps) {
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium leading-none">{name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{email}</p>
      </div>

      <Badge
        variant={roleVariants[role] ?? "secondary"}
        className="text-[10px] px-1.5 py-0.5 hidden sm:inline-flex"
      >
        {role}
      </Badge>

      <button
        type="button"
        onClick={() => setChangePasswordOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground border border-input rounded-md px-2.5 py-1.5 transition-colors hover:bg-accent"
      >
        Alterar senha
      </button>

      <form action={signOutAction}>
        <button
          type="submit"
          className="text-xs text-muted-foreground hover:text-foreground border border-input rounded-md px-2.5 py-1.5 transition-colors hover:bg-accent"
        >
          Sair
        </button>
      </form>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </div>
  );
}
