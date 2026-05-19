"use client";
import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, AlertTriangle } from "lucide-react";
import { useCallback } from "react";

interface FilterOptions {
  statuses: { id: string; name: string }[];
  origins: { id: string; name: string }[];
  destinations: { id: string; name: string }[];
  damageTypes: { id: string; name: string }[];
  users: { id: string; name: string }[];
}

interface OccurrencesFilterProps {
  filterOptions: FilterOptions;
  currentParams: Record<string, string>;
  /** When false (SEPARADOR), the user filter is hidden and scoping is enforced server-side. */
  canViewAll: boolean;
}

export function OccurrencesFilter({
  filterOptions,
  currentParams,
  canViewAll,
}: OccurrencesFilterProps) {
  const router = useRouter();
  const pathname = usePathname();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(currentParams);
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Any filter change resets to page 1
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [currentParams, pathname, router]
  );

  const clearAll = () => router.push(pathname);

  const hasFilters =
    Object.keys(currentParams).filter((k) => k !== "page" && k !== "pageSize").length > 0;

  return (
    <div className="flex flex-wrap gap-2 items-start p-4 bg-card rounded-lg border">
      {/* ── Row 1: scalar filters ────────────────────────────────────── */}
      {/* Código */}
      <Input
        placeholder="Buscar por código..."
        className="w-full sm:w-44"
        defaultValue={currentParams.code ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter")
            updateFilter("code", (e.target as HTMLInputElement).value);
        }}
        onBlur={(e) => updateFilter("code", e.target.value)}
      />

      {/* Status */}
      <Select
        value={currentParams.statusId ?? "all"}
        onValueChange={(v) => updateFilter("statusId", v)}
      >
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Status</SelectItem>
          {filterOptions.statuses.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Ciclo de vida */}
      <Select
        value={currentParams.lifecycle ?? "all"}
        onValueChange={(v) => updateFilter("lifecycle", v)}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Ciclo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="open">Somente Abertas</SelectItem>
          <SelectItem value="closed">Somente Encerradas</SelectItem>
        </SelectContent>
      </Select>

      {/* Origem */}
      <Select
        value={currentParams.originId ?? "all"}
        onValueChange={(v) => updateFilter("originId", v)}
      >
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue placeholder="Origem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as Origens</SelectItem>
          {filterOptions.origins.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Tipo de avaria */}
      <Select
        value={currentParams.damageTypeId ?? "all"}
        onValueChange={(v) => updateFilter("damageTypeId", v)}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Tipo de Avaria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Tipos</SelectItem>
          {filterOptions.damageTypes.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Destinação */}
      <Select
        value={currentParams.destinationId ?? "all"}
        onValueChange={(v) => updateFilter("destinationId", v)}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Destinação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as Destinações</SelectItem>
          {filterOptions.destinations.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Responsável — visível apenas para roles com view_all */}
      {canViewAll && filterOptions.users.length > 0 && (
        <Select
          value={currentParams.openedByUserId ?? "all"}
          onValueChange={(v) => updateFilter("openedByUserId", v)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {filterOptions.users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* ── Row 2: date ranges ───────────────────────────────────────── */}
      <div className="w-full sm:w-auto flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Abertura:</span>
        <Input
          key={`dateFrom-${currentParams.dateFrom ?? ""}`}
          type="date"
          className="flex-1 sm:flex-none sm:w-36"
          defaultValue={currentParams.dateFrom ?? ""}
          onBlur={(e) => updateFilter("dateFrom", e.target.value)}
        />
        <span className="text-muted-foreground text-xs">–</span>
        <Input
          key={`dateTo-${currentParams.dateTo ?? ""}`}
          type="date"
          className="flex-1 sm:flex-none sm:w-36"
          defaultValue={currentParams.dateTo ?? ""}
          onBlur={(e) => updateFilter("dateTo", e.target.value)}
        />
      </div>

      <div className="w-full sm:w-auto flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Encerramento:</span>
        <Input
          key={`completedFrom-${currentParams.completedFrom ?? ""}`}
          type="date"
          className="flex-1 sm:flex-none sm:w-36"
          defaultValue={currentParams.completedFrom ?? ""}
          onBlur={(e) => updateFilter("completedFrom", e.target.value)}
        />
        <span className="text-muted-foreground text-xs">–</span>
        <Input
          key={`completedTo-${currentParams.completedTo ?? ""}`}
          type="date"
          className="flex-1 sm:flex-none sm:w-36"
          defaultValue={currentParams.completedTo ?? ""}
          onBlur={(e) => updateFilter("completedTo", e.target.value)}
        />
      </div>

      {/* ── Sem preço toggle ─────────────────────────────────────────── */}
      <Button
        variant={currentParams.noPrice === "true" ? "secondary" : "outline"}
        size="sm"
        onClick={() =>
          updateFilter("noPrice", currentParams.noPrice === "true" ? "" : "true")
        }
        className="gap-1.5 w-full sm:w-auto"
      >
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        Sem preço
      </Button>

      {/* ── Clear all ────────────────────────────────────────────────── */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="gap-1 w-full sm:w-auto"
        >
          <X className="h-4 w-4" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
