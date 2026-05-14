import { auth, signOut } from "@/auth";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/lib/auth/types";

const roleVariants: Record<UserRole, "default" | "secondary" | "success" | "warning" | "info" | "destructive"> = {
  ADMIN: "destructive",
  GESTOR: "default",
  ANALISTA: "info",
  LIDER: "warning",
  SEPARADOR: "secondary",
};

export async function AuthUserMenu() {
  const session = await auth();
  if (!session?.user) return null;

  const { name, email, role } = session.user;

  return (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium leading-none">{name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{email}</p>
      </div>
      <Badge variant={roleVariants[role] ?? "secondary"} className="text-[10px] px-1.5 py-0.5 hidden sm:inline-flex">
        {role}
      </Badge>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="text-xs text-muted-foreground hover:text-foreground border border-input rounded-md px-2.5 py-1.5 transition-colors hover:bg-accent"
        >
          Sair
        </button>
      </form>
    </div>
  );
}
