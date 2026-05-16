"use client";
import type { DashboardFilters, DashboardParam } from "@/lib/dashboard/types";

interface FilterBarProps {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  onClear: () => void;
  statuses: DashboardParam[];
  origins: DashboardParam[];
  damageTypes: DashboardParam[];
  destinations: DashboardParam[];
  users: DashboardParam[];
}

const fieldClass =
  "w-full rounded-md px-2.5 py-1.5 text-sm outline-none cursor-pointer transition-colors focus:ring-2 focus:ring-offset-0";

const fieldStyle = {
  background: "#FFFFFF",
  border: "1px solid #DDE7DE",
  color: "#1C2A24",
  colorScheme: "light" as const,
};

const labelStyle = {
  color: "#6B756F",
  fontSize: "10px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.12em",
  fontWeight: 600,
};

export function FilterBar({
  filters,
  onChange,
  onClear,
  statuses,
  origins,
  damageTypes,
  destinations,
  users,
}: FilterBarProps) {
  const set =
    (key: keyof DashboardFilters) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
      onChange({ ...filters, [key]: e.target.value });

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{
        background: "#FFFFFF",
        border: "1px solid #DDE7DE",
        boxShadow: "0 1px 2px rgba(8,56,51,0.03)",
      }}
    >
      <div className="flex flex-wrap gap-x-4 gap-y-3 items-end">
        <div className="flex flex-col gap-1 min-w-[130px] flex-1">
          <span style={labelStyle}>Data inicial</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={set("dateFrom")}
            className={fieldClass}
            style={fieldStyle}
          />
        </div>

        <div className="flex flex-col gap-1 min-w-[130px] flex-1">
          <span style={labelStyle}>Data final</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={set("dateTo")}
            className={fieldClass}
            style={fieldStyle}
          />
        </div>

        <div className="flex flex-col gap-1 min-w-[150px] flex-1">
          <span style={labelStyle}>Status</span>
          <select
            value={filters.statusId}
            onChange={set("statusId")}
            className={fieldClass}
            style={fieldStyle}
          >
            <option value="">Todos</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[140px] flex-1">
          <span style={labelStyle}>Origem</span>
          <select
            value={filters.originId}
            onChange={set("originId")}
            className={fieldClass}
            style={fieldStyle}
          >
            <option value="">Todas</option>
            {origins.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[150px] flex-1">
          <span style={labelStyle}>Tipo de avaria</span>
          <select
            value={filters.damageTypeId}
            onChange={set("damageTypeId")}
            className={fieldClass}
            style={fieldStyle}
          >
            <option value="">Todos</option>
            {damageTypes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[140px] flex-1">
          <span style={labelStyle}>Destino</span>
          <select
            value={filters.destinationId}
            onChange={set("destinationId")}
            className={fieldClass}
            style={fieldStyle}
          >
            <option value="">Todos</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[150px] flex-1">
          <span style={labelStyle}>Responsável</span>
          <select
            value={filters.userId}
            onChange={set("userId")}
            className={fieldClass}
            style={fieldStyle}
          >
            <option value="">Todos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onClear}
          disabled={activeCount === 0}
          className="px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap"
          style={{
            background: activeCount > 0 ? "#FFFFFF" : "transparent",
            border: `1px solid ${activeCount > 0 ? "#0D6F65" : "#DDE7DE"}`,
            color: activeCount > 0 ? "#0D6F65" : "#9AA59F",
            cursor: activeCount > 0 ? "pointer" : "default",
          }}
        >
          {activeCount > 0
            ? `Limpar filtros · ${activeCount}`
            : "Limpar filtros"}
        </button>
      </div>
    </div>
  );
}
