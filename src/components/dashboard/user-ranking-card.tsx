"use client";
import { HorizontalBarChart } from "./charts/horizontal-bar-chart";
import { CHART_COLORS } from "@/lib/dashboard/chart-utils";

interface UserRankingItem {
  id: string;
  name: string;
  role: string;
  count: number;
}

interface UserRankingCardProps {
  data: UserRankingItem[];
  visible: boolean;
  limit?: number;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  GESTOR: "Gestor",
  ANALISTA: "Analista",
  LIDER: "Líder",
  SEPARADOR: "Separador",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "#4EA3D9",
  GESTOR: "#0D6F65",
  ANALISTA: "#1A8B80",
  LIDER: "#2F7D46",
  SEPARADOR: "#6B756F",
};

export function UserRankingCard({
  data,
  visible,
  limit = 8,
}: UserRankingCardProps) {
  if (!visible) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p
          className="text-xs text-center px-4 py-2 rounded-lg max-w-xs"
          style={{
            color: CHART_COLORS.text,
            background: "#FBFCF8",
            border: `1px solid ${CHART_COLORS.border}`,
          }}
        >
          Acesso restrito a Gestores e Administradores
        </p>
      </div>
    );
  }

  const items = data.map((u) => ({
    id: u.id,
    name: u.name,
    value: u.count,
    meta: ROLE_LABELS[u.role] ?? u.role,
    metaColor: ROLE_COLORS[u.role] ?? "#6B756F",
  }));

  return (
    <HorizontalBarChart
      data={items}
      limit={limit}
      color="#0D6F65"
      emptyMessage="Sem aberturas no período"
    />
  );
}
