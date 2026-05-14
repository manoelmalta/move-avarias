"use client";
import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { useCallback } from "react";

interface FilterOptions {
  statuses: { id: string; name: string }[];
  origins: { id: string; name: string }[];
  destinations: { id: string; name: string }[];
}

export function OccurrencesFilter({
  filterOptions,
  currentParams,
}: {
  filterOptions: FilterOptions;
  currentParams: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const updateFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(currentParams);
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [currentParams, pathname, router]);

  const clearAll = () => router.push(pathname);

  const hasFilters = Object.keys(currentParams).length > 0;

  return (
    <div className="flex flex-wrap gap-2 items-center p-4 bg-card rounded-lg border">
      <Input
        placeholder="Buscar por código..."
        className="w-48"
        defaultValue={currentParams.code ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") updateFilter("code", (e.target as HTMLInputElement).value);
        }}
        onBlur={(e) => updateFilter("code", e.target.value)}
      />
      <Select value={currentParams.statusId ?? "all"} onValueChange={(v) => updateFilter("statusId", v)}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Status</SelectItem>
          {filterOptions.statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={currentParams.originId ?? "all"} onValueChange={(v) => updateFilter("originId", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Origem" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as Origens</SelectItem>
          {filterOptions.origins.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={currentParams.destinationId ?? "all"} onValueChange={(v) => updateFilter("destinationId", v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Destinação" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as Destinações</SelectItem>
          {filterOptions.destinations.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input
        type="date"
        className="w-36"
        defaultValue={currentParams.dateFrom ?? ""}
        onBlur={(e) => updateFilter("dateFrom", e.target.value)}
      />
      <Input
        type="date"
        className="w-36"
        defaultValue={currentParams.dateTo ?? ""}
        onBlur={(e) => updateFilter("dateTo", e.target.value)}
      />
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="h-4 w-4" />Limpar
        </Button>
      )}
    </div>
  );
}
