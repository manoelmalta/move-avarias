"use client";
import { useSession } from "@/lib/auth/session-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const roleColors: Record<string, "default" | "secondary" | "success" | "warning" | "info" | "destructive"> = {
  ADMIN: "destructive",
  GESTOR: "default",
  ANALISTA: "info",
  LIDER: "warning",
  SEPARADOR: "secondary",
};

export function UserSelector() {
  const { user, setUser, users } = useSession();

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground hidden sm:block">Usuário simulado:</span>
      <Select value={user.id} onValueChange={(id) => {
        const found = users.find((u) => u.id === id);
        if (found) setUser(found);
      }}>
        <SelectTrigger className="w-[200px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              <div className="flex items-center gap-2">
                <span>{u.name}</span>
                <Badge variant={roleColors[u.role] ?? "secondary"} className="text-[10px] px-1 py-0">
                  {u.role}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
