"use client";
import { Info } from "lucide-react";

interface DataQualityCardProps {
  totalItems: number;
  zeroValueItems: number;
  zeroValuePercent: number;
  uniqueProductsWithoutPrice: number;
  stuckOccurrences: number;
  totalOccurrences: number;
  openOccurrences: number;
}

interface AlertRowProps {
  label: string;
  value: string;
  level: "ok" | "warn" | "alert";
}

const LEVEL_COLORS = {
  ok: "#2F7D46",
  warn: "#9C7822",
  alert: "#A24545",
};

function AlertRow({ label, value, level }: AlertRowProps) {
  const color = LEVEL_COLORS[level];
  const bg =
    level === "ok"
      ? "transparent"
      : level === "warn"
        ? "rgba(215,166,58,0.08)"
        : "rgba(201,90,90,0.07)";
  return (
    <div
      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md"
      style={{ background: bg }}
    >
      <span className="text-[12.5px]" style={{ color: "#1C2A24" }}>
        {label}
      </span>
      <span
        className="text-[12.5px] font-semibold tabular-nums whitespace-nowrap"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}

export function DataQualityCard({
  totalItems,
  zeroValueItems,
  zeroValuePercent,
  uniqueProductsWithoutPrice,
  stuckOccurrences,
  totalOccurrences,
  openOccurrences,
}: DataQualityCardProps) {
  const priceLevel: AlertRowProps["level"] =
    zeroValuePercent > 50 ? "alert" : zeroValuePercent > 10 ? "warn" : "ok";
  const stuckLevel: AlertRowProps["level"] =
    stuckOccurrences > 5 ? "alert" : stuckOccurrences > 0 ? "warn" : "ok";
  const openLevel: AlertRowProps["level"] =
    openOccurrences > totalOccurrences * 0.7 ? "warn" : "ok";

  return (
    <div
      className="rounded-xl flex flex-col gap-4"
      style={{
        background: "#FBFCF8",
        border: "1px solid #DDE7DE",
        padding: 20,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info size={14} strokeWidth={2.25} style={{ color: "#0D6F65" }} />
          <h3
            className="text-[13px] font-semibold tracking-tight"
            style={{ color: "#044C45" }}
          >
            Governança de dados
          </h3>
        </div>
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: "#EAF1EC", color: "#0D6F65" }}
        >
          Cobertura em implantação
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <AlertRow
          label="Itens sem preço cadastrado"
          value={`${zeroValueItems} de ${totalItems} (${zeroValuePercent.toFixed(0)}%)`}
          level={priceLevel}
        />
        <AlertRow
          label="Produtos sem preço usados em ocorrências"
          value={`${uniqueProductsWithoutPrice}`}
          level={uniqueProductsWithoutPrice > 0 ? "warn" : "ok"}
        />
        <AlertRow
          label="Ocorrências paradas no status inicial (+7 dias)"
          value={`${stuckOccurrences}`}
          level={stuckLevel}
        />
        <AlertRow
          label="Ocorrências ainda sem finalização"
          value={`${openOccurrences} de ${totalOccurrences}`}
          level={openLevel}
        />
      </div>

      <div
        className="rounded-md px-3 py-2.5 text-[11.5px] leading-relaxed"
        style={{
          background: "#EAF1EC",
          border: "1px solid #DDE7DE",
          color: "#1C2A24",
        }}
      >
        <strong style={{ color: "#044C45" }}>Nota:</strong> Itens sem preço não
        compõem o valor acumulado do período. A base de custos do cliente
        poderá atualizar o cálculo financeiro à medida que for sendo
        cadastrada.
      </div>
    </div>
  );
}
