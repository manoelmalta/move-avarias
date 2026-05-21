"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, UserCheck, UserX } from "lucide-react";

interface Origin {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
}

interface OriginsManagerProps {
  origins: Origin[];
}

export function OriginsManager({ origins: initial }: OriginsManagerProps) {
  const router = useRouter();
  const [origins, setOrigins] = useState<Origin[]>(initial);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clearMessages = () => { setError(""); setSuccess(""); };

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (trimmed.length < 2) {
      setError("Nome deve ter pelo menos 2 caracteres.");
      return;
    }

    clearMessages();
    setAdding(true);
    try {
      const res = await fetch("/api/parameters/origins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json() as { error?: string | Record<string, unknown>; id?: string; name?: string; active?: boolean; sortOrder?: number };

      if (!res.ok) {
        const msg = typeof json.error === "string" ? json.error : "Dados inválidos.";
        setError(msg);
        return;
      }

      const created = json as Origin;
      setOrigins((prev) => [...prev, created]);
      setNewName("");
      setSuccess(`Origem "${created.name}" criada com sucesso.`);
      router.refresh();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (origin: Origin) => {
    clearMessages();
    setToggling(origin.id);
    try {
      const res = await fetch(`/api/parameters/origins/${origin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !origin.active }),
      });
      const json = await res.json() as { error?: string; id?: string; name?: string; active?: boolean; sortOrder?: number };

      if (!res.ok) {
        const msg = typeof json.error === "string" ? json.error : "Erro ao atualizar origem.";
        setError(msg);
        return;
      }

      const updated = json as Origin;
      setOrigins((prev) =>
        prev.map((o) => (o.id === updated.id ? updated : o))
      );
      setSuccess(
        `Origem "${updated.name}" ${updated.active ? "ativada" : "inativada"} com sucesso.`
      );
      router.refresh();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setToggling(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !adding) {
      void handleAdd();
    }
  };

  return (
    <div className="space-y-4">
      {/* Lista de origens */}
      <div className="space-y-1">
        {origins.map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between text-sm py-2 border-b last:border-0"
          >
            <span className={o.active ? undefined : "text-muted-foreground line-through"}>
              {o.name}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant={o.active ? "success" : "secondary"}>
                {o.active ? "Ativo" : "Inativo"}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => handleToggle(o)}
                disabled={toggling === o.id}
                title={o.active ? "Inativar" : "Ativar"}
              >
                {toggling === o.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : o.active ? (
                  <UserX className="h-3.5 w-3.5" />
                ) : (
                  <UserCheck className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        ))}
        {origins.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">Nenhuma origem cadastrada.</p>
        )}
      </div>

      {/* Adicionar nova origem */}
      <div className="pt-2 border-t space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Nova Origem
        </p>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => { setNewName(e.target.value); clearMessages(); }}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Vendas"
            className="h-9 text-sm"
            disabled={adding}
            maxLength={80}
          />
          <Button
            size="sm"
            onClick={() => void handleAdd()}
            disabled={adding || newName.trim().length < 2}
            className="h-9 px-3 shrink-0"
          >
            {adding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Adicionar
          </Button>
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
            {error}
          </p>
        )}
        {success && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5">
            {success}
          </p>
        )}
      </div>
    </div>
  );
}
