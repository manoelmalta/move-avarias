"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { X, ExternalLink, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuickViewItem {
  id: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  batch: string | null;
  expirationDate: string | null;
  product: {
    internalCode: string;
    description: string;
    ean: string;
    dun: string | null;
  };
  damageType: { name: string };
}

interface QuickViewAuditLog {
  id: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { name: string; email: string; role: string };
}

interface QuickViewOccurrence {
  id: string;
  occurrenceCode: string;
  description: string;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  openedBy: { id: string; name: string; email: string; role: string };
  origin: { name: string };
  status: { id: string; name: string; isFinal: boolean };
  destination: { id: string; name: string } | null;
  items: QuickViewItem[];
  auditLogs: QuickViewAuditLog[];
}

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "info" | "destructive" | "purple";

function getStatusVariant(statusName: string): BadgeVariant {
  if (statusName.includes("5-") || statusName.toLowerCase().includes("finalizado")) return "success";
  if (statusName.includes("4-") || statusName.toLowerCase().includes("destinação finalizada")) return "purple";
  if (statusName.includes("3-") || statusName.toLowerCase().includes("definida")) return "info";
  if (statusName.includes("2-") || statusName.toLowerCase().includes("tratamento")) return "warning";
  return "secondary";
}

// Result: only success/error/idle — "loading" is covered by isPending from useTransition
type FetchResult =
  | { status: "idle" }
  | { status: "success"; data: QuickViewOccurrence }
  | { status: "error"; errorMessage: string };

// ── Props ─────────────────────────────────────────────────────────────────────

interface OccurrenceQuickViewProps {
  occurrenceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OccurrenceQuickView({
  occurrenceId,
  open,
  onOpenChange,
}: OccurrenceQuickViewProps) {
  const [result, setResult] = useState<FetchResult>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!open || !occurrenceId) return;

    let cancelled = false;

    // startTransition wraps the async fetch — all setResult calls are inside
    // async callbacks, which satisfies react-hooks/set-state-in-effect.
    // isPending is true while the transition is running, acting as loading state.
    startTransition(async () => {
      try {
        const res = await fetch(`/api/occurrences/${occurrenceId}`);
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 404)
            throw new Error("Ocorrência não encontrada ou sem permissão de acesso.");
          throw new Error("Erro ao carregar a ocorrência. Tente novamente.");
        }
        const data = (await res.json()) as QuickViewOccurrence;
        if (!cancelled) setResult({ status: "success", data });
      } catch (err) {
        if (!cancelled)
          setResult({ status: "error", errorMessage: (err as Error).message });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, occurrenceId, retryCount]);

  const handleRetry = () => {
    // Reset to idle in an event handler (not an effect) — no rule violation
    setResult({ status: "idle" });
    setRetryCount((c) => c + 1);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {/* ── Loading ───────────────────────────────────────────────────── */}
        {isPending && (
          <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {!isPending && result.status === "error" && (
          <>
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">
                Detalhe da Ocorrência
              </span>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p className="text-sm text-muted-foreground">{result.errorMessage}</p>
              <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </Button>
            </div>
          </>
        )}

        {/* ── Success ───────────────────────────────────────────────────── */}
        {!isPending && result.status === "success" && (
          <DrawerBody occ={result.data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── DrawerBody ────────────────────────────────────────────────────────────────

function DrawerBody({ occ }: { occ: QuickViewOccurrence }) {
  const totalValue = occ.items.reduce((s, i) => s + i.totalValue, 0);
  const totalQty = occ.items.reduce((s, i) => s + i.quantity, 0);
  const hasZeroPrice = occ.items.some((i) => i.unitValue === 0);
  const damageTypes = [...new Map(occ.items.map((i) => [i.damageType.name, true])).keys()];
  const hasEan = occ.items.some((i) => i.product.ean);
  const hasDun = occ.items.some((i) => i.product.dun);
  const latestLogs = occ.auditLogs.slice(0, 3);

  return (
    <>
      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-sm font-semibold">{occ.occurrenceCode}</span>
          <Badge
            variant={getStatusVariant(occ.status.name)}
            className="shrink-0 text-xs"
          >
            {occ.status.name}
          </Badge>
          {hasZeroPrice && (
            <AlertTriangle
              className="h-4 w-4 shrink-0 text-amber-500"
              aria-label="Contém item sem preço"
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Abrir em nova aba"
          >
            <Link href={`/occurrences/${occ.id}`} target="_blank">
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </div>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4">
          {/* Summary pills */}
          <div className="flex flex-wrap gap-2">
            <Pill label="Origem" value={occ.origin.name} />
            <Pill label="Responsável" value={occ.openedBy.name} />
            <Pill label="Abertura" value={formatDateTime(occ.createdAt)} />
            {occ.completedAt && (
              <Pill label="Encerramento" value={formatDateTime(occ.completedAt)} />
            )}
            {occ.destination && (
              <Pill label="Destinação" value={occ.destination.name} />
            )}
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Itens" value={String(occ.items.length)} />
            <StatCard label="Qtd total" value={String(totalQty)} />
            <StatCard label="Valor total" value={formatCurrency(totalValue)} />
          </div>

          {/* Description */}
          <Section title="Descrição">
            <p className="text-sm text-foreground">{occ.description}</p>
          </Section>

          {/* Notes */}
          {occ.notes && (
            <Section title="Observações">
              <p className="text-sm text-muted-foreground">{occ.notes}</p>
            </Section>
          )}

          {/* Damage type badges */}
          {damageTypes.length > 0 && (
            <Section title="Tipos de Avaria">
              <div className="flex flex-wrap gap-1.5">
                {damageTypes.map((dt) => (
                  <Badge key={dt} variant="secondary" className="text-xs">
                    {dt}
                  </Badge>
                ))}
              </div>
            </Section>
          )}

          {/* Items table */}
          <Section title="Produtos">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Código
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Descrição
                    </th>
                    {hasEan && (
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        EAN
                      </th>
                    )}
                    {hasDun && (
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        DUN
                      </th>
                    )}
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Avaria
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Qtd
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Unit.
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {occ.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono">{item.product.internalCode}</td>
                      <td
                        className="max-w-[140px] truncate px-3 py-2"
                        title={item.product.description}
                      >
                        {item.product.description}
                      </td>
                      {hasEan && (
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {item.product.ean || "—"}
                        </td>
                      )}
                      {hasDun && (
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {item.product.dun ?? "—"}
                        </td>
                      )}
                      <td className="px-3 py-2">{item.damageType.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {item.unitValue === 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            {formatCurrency(0)}
                          </span>
                        ) : (
                          formatCurrency(item.unitValue)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(item.totalValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Recent audit log */}
          {latestLogs.length > 0 && (
            <Section
              title={`Histórico recente${occ.auditLogs.length > 3 ? ` (${occ.auditLogs.length} entradas)` : ""}`}
            >
              <div className="space-y-1.5">
                {latestLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-md border bg-muted/20 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium text-foreground">{log.user.name}</span>
                      <span>·</span>
                      <span>{formatDateTime(log.createdAt)}</span>
                    </div>
                    <div className="mt-0.5">
                      <span>{log.action}</span>
                      {log.fieldName && (
                        <span className="text-muted-foreground"> · {log.fieldName}</span>
                      )}
                      {log.oldValue && (
                        <span className="ml-1 line-through text-muted-foreground">
                          {log.oldValue}
                        </span>
                      )}
                      {log.newValue && (
                        <span className="ml-1 font-medium">{log.newValue}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* ── Sticky footer ─────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-3">
        <Button asChild variant="default" size="sm">
          <Link href={`/occurrences/${occ.id}`}>
            <ExternalLink className="h-4 w-4" />
            Abrir detalhe completo
          </Link>
        </Button>
        <SheetClose asChild>
          <Button variant="outline" size="sm">
            Fechar
          </Button>
        </SheetClose>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-baseline gap-1 rounded-full border bg-muted/30 px-2.5 py-1 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}
