"use client";
import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth/session-context";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  Search,
  Loader2,
  ScanBarcode,
  Package,
  PackagePlus,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";

// ── Domain types ───────────────────────────────────────────────────────────────

interface ProductSummary {
  id: string;
  internalCode: string;
  description: string;
  ean: string;
  dun: string | null;
  active: boolean;
  currentPrice: number | null;
}

interface OccurrenceCard {
  id: string;
  occurrenceCode: string;
  status: { name: string };
  origin: { name: string };
  destination: { name: string } | null;
  createdAt: string;
  quantity: number;
  totalValue: number;
}

interface ClosedOccurrenceCard extends OccurrenceCard {
  completedAt: string;
}

interface SingleResult {
  product: ProductSummary;
  stats: {
    totalQuantity: number;
    totalValue: number;
    openCount: number;
    closedCount: number;
    totalOccurrences: number;
  };
  damageTypes: { name: string; quantity: number; value: number }[];
  destinations: { name: string; count: number }[];
  openOccurrences: OccurrenceCard[];
  recentClosedOccurrences: ClosedOccurrenceCard[];
}

// ── API response union ─────────────────────────────────────────────────────────

type ApiResponse =
  | ({ mode: "single" } & SingleResult)
  | { mode: "multiple"; results: ProductSummary[] }
  | { error: string };

// ── UI state machine ───────────────────────────────────────────────────────────

type LookupState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "single"; data: SingleResult; query: string }
  | { phase: "multiple"; results: ProductSummary[]; query: string }
  | { phase: "not_found"; query: string }
  | { phase: "error"; message: string };

// ── Main component ─────────────────────────────────────────────────────────────

export function ProductLookup() {
  const { user } = useSession();
  const canCreate = user ? hasPermission(user, "occurrence:create") : false;

  const [query, setQuery] = useState("");
  const [state, setState] = useState<LookupState>({ phase: "idle" });
  const [showClosed, setShowClosed] = useState(false);

  // ── Fetch helpers ────────────────────────────────────────────────────────────

  const fetchAndApply = async (url: string, queryLabel: string) => {
    setState({ phase: "loading" });
    setShowClosed(false);
    try {
      const res = await fetch(url);
      const data = await res.json() as ApiResponse;

      if (!res.ok || "error" in data) {
        const msg = ("error" in data ? data.error : null) ?? "Erro ao buscar produto";
        if (res.status === 404) {
          setState({ phase: "not_found", query: queryLabel });
        } else {
          setState({ phase: "error", message: msg });
        }
        return;
      }

      if (data.mode === "single") {
        setState({ phase: "single", data: data, query: queryLabel });
      } else {
        setState({ phase: "multiple", results: data.results, query: queryLabel });
      }
    } catch {
      setState({ phase: "error", message: "Erro de rede. Tente novamente." });
    }
  };

  const searchByQuery = () => {
    const q = query.trim();
    if (q.length < 2) {
      setState({ phase: "error", message: "Informe ao menos 2 caracteres para buscar" });
      return;
    }
    void fetchAndApply(`/api/products/lookup?query=${encodeURIComponent(q)}`, q);
  };

  const selectProduct = (p: ProductSummary) => {
    void fetchAndApply(`/api/products/lookup?productId=${encodeURIComponent(p.id)}`, p.description);
  };

  const reset = () => {
    setState({ phase: "idle" });
    setShowClosed(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); searchByQuery(); }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* Search bar — always visible */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Código interno, EAN, DUN ou descrição..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9 h-12 text-base"
                autoFocus
                disabled={state.phase === "loading"}
              />
            </div>
            <Button
              onClick={searchByQuery}
              disabled={state.phase === "loading"}
              className="h-12 px-5 shrink-0"
            >
              {state.phase === "loading"
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Search className="h-4 w-4" />
              }
              <span className="hidden sm:inline ml-2">Buscar</span>
            </Button>
            {/* Placeholder for future camera integration (Phase 4D) */}
            <Button
              variant="outline"
              disabled
              className="h-12 w-12 shrink-0 p-0"
              title="Leitura por câmera — em breve"
              aria-label="Leitura por câmera (em breve)"
            >
              <ScanBarcode className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>

          {state.phase === "error" && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {state.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Idle ─────────────────────────────────────────────────────────── */}
      {state.phase === "idle" && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Package className="h-12 w-12 opacity-25" />
          <p className="text-sm">Digite um código ou descrição e pressione Buscar</p>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {state.phase === "loading" && (
        <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Buscando…</span>
        </div>
      )}

      {/* ── Not found ─────────────────────────────────────────────────────── */}
      {state.phase === "not_found" && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center space-y-3">
            <Package className="h-10 w-10 mx-auto opacity-30" />
            <p className="text-sm font-medium">Produto não encontrado</p>
            <p className="text-xs text-muted-foreground">
              Nenhum produto corresponde a &ldquo;{state.query}&rdquo;.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Multiple results ───────────────────────────────────────────────── */}
      {state.phase === "multiple" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Produtos encontrados ({state.results.length})
            </h2>
            <Button variant="ghost" size="sm" onClick={reset} className="gap-1 h-8 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              Nova busca
            </Button>
          </div>
          {state.results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectProduct(p)}
              className="w-full text-left focus:outline-none focus:ring-2 focus:ring-ring rounded-lg"
            >
              <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold">{p.internalCode}</span>
                        <Badge variant={p.active ? "success" : "secondary"} className="text-xs">
                          {p.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm leading-tight">{p.description}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>EAN: <span className="font-mono">{p.ean.startsWith("SEM-EAN-") ? "—" : p.ean}</span></span>
                        {p.dun && <span>DUN: <span className="font-mono">{p.dun}</span></span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {p.currentPrice != null
                        ? <span className="text-sm font-semibold">{formatCurrency(p.currentPrice)}</span>
                        : <span className="text-xs text-muted-foreground">Sem preço</span>
                      }
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* ── Single result ──────────────────────────────────────────────────── */}
      {state.phase === "single" && (
        <SingleResultView
          data={state.data}
          canCreate={canCreate}
          showClosed={showClosed}
          onToggleClosed={() => setShowClosed((v) => !v)}
          onReset={reset}
        />
      )}
    </div>
  );
}

// ── Single result view ─────────────────────────────────────────────────────────

function SingleResultView({
  data,
  canCreate,
  showClosed,
  onToggleClosed,
  onReset,
}: {
  data: SingleResult;
  canCreate: boolean;
  showClosed: boolean;
  onToggleClosed: () => void;
  onReset: () => void;
}) {
  const { product, stats, damageTypes, destinations, openOccurrences, recentClosedOccurrences } = data;

  return (
    <div className="space-y-4">
      {/* Product card */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-muted-foreground">
                  {product.internalCode}
                </span>
                <Badge variant={product.active ? "success" : "secondary"}>
                  {product.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <p className="font-semibold text-lg leading-tight">{product.description}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>EAN: <span className="font-mono">{product.ean.startsWith("SEM-EAN-") ? "—" : product.ean}</span></span>
                {product.dun && <span>DUN: <span className="font-mono">{product.dun}</span></span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">Preço vigente</p>
              <p className="text-xl font-bold">
                {product.currentPrice != null
                  ? formatCurrency(product.currentPrice)
                  : <span className="text-sm font-normal text-muted-foreground">Sem preço cadastrado</span>
                }
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t flex items-center justify-between gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={onReset} className="gap-1 h-8 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              Nova busca
            </Button>
            {canCreate && (
              <Button asChild size="sm">
                <Link href="/occurrences/new">
                  <PackagePlus className="h-4 w-4" />
                  Abrir nova ocorrência
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Ocorrências abertas" value={stats.openCount} />
        <StatCard label="Ocorrências encerradas" value={stats.closedCount} />
        <StatCard label="Qtd total avariada" value={stats.totalQuantity} decimals />
        <StatCard label="Valor acumulado" value={stats.totalValue} currency />
      </div>

      {/* Breakdowns */}
      {(damageTypes.length > 0 || destinations.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {damageTypes.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Tipos de Avaria</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {damageTypes.map((dt) => (
                  <div key={dt.name} className="flex items-center justify-between text-sm gap-2">
                    <span className="flex-1 truncate">{dt.name}</span>
                    <span className="text-muted-foreground shrink-0">{dt.quantity}x</span>
                    <span className="font-medium shrink-0">{formatCurrency(dt.value)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {destinations.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Destinações</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {destinations.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-sm gap-2">
                    <span className="flex-1 truncate">{d.name}</span>
                    <Badge variant="secondary">{d.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Open occurrences */}
      {openOccurrences.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Ocorrências abertas ({stats.openCount})
          </h2>
          {openOccurrences.map((occ) => (
            <OccurrenceCardView key={occ.id} occ={occ} type="open" />
          ))}
          {stats.openCount > openOccurrences.length && (
            <p className="text-xs text-muted-foreground text-center">
              Exibindo as 10 mais recentes.{" "}
              <Link href="/occurrences" className="underline">Ver todas em Ocorrências</Link>.
            </p>
          )}
        </div>
      ) : (
        stats.totalOccurrences > 0 && (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma ocorrência aberta para este produto.
            </CardContent>
          </Card>
        )
      )}

      {/* Closed occurrences — collapsible */}
      {recentClosedOccurrences.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onToggleClosed}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide w-full hover:text-foreground transition-colors"
          >
            {showClosed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Ocorrências encerradas ({stats.closedCount})
          </button>
          {showClosed && (
            <div className="space-y-2">
              {recentClosedOccurrences.map((occ) => (
                <OccurrenceCardView key={occ.id} occ={occ} type="closed" />
              ))}
              {stats.closedCount > recentClosedOccurrences.length && (
                <p className="text-xs text-muted-foreground text-center">
                  Exibindo as 10 mais recentes.{" "}
                  <Link href="/occurrences" className="underline">Ver todas em Ocorrências</Link>.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* No occurrences at all */}
      {stats.totalOccurrences === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma ocorrência registrada para este produto.</p>
            {canCreate && (
              <Button asChild className="mt-4" size="sm">
                <Link href="/occurrences/new">
                  <PackagePlus className="h-4 w-4" />
                  Abrir primeira ocorrência
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatCard({
  label, value, currency, decimals,
}: {
  label: string; value: number; currency?: boolean; decimals?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        <p className="text-xl font-bold mt-1">
          {currency
            ? formatCurrency(value)
            : decimals
              ? value % 1 === 0 ? value.toString() : value.toFixed(3)
              : value}
        </p>
      </CardContent>
    </Card>
  );
}

function OccurrenceCardView({
  occ,
  type,
}: {
  occ: OccurrenceCard | ClosedOccurrenceCard;
  type: "open" | "closed";
}) {
  return (
    <Card className={type === "open" ? "border-amber-200 bg-amber-50/30" : ""}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold">{occ.occurrenceCode}</span>
              <Badge variant="secondary" className="text-xs">{occ.status.name}</Badge>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>Origem: {occ.origin.name}</span>
              {occ.destination && <span>Destino: {occ.destination.name}</span>}
              <span>Abertura: {formatDateTime(new Date(occ.createdAt))}</span>
              {type === "closed" && "completedAt" in occ && (
                <span>Encerramento: {formatDateTime(new Date(occ.completedAt))}</span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 space-y-0.5">
            <p className="text-sm font-medium">{formatCurrency(occ.totalValue)}</p>
            <p className="text-xs text-muted-foreground">
              {occ.quantity % 1 === 0 ? occ.quantity : occ.quantity.toFixed(3)}x
            </p>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button asChild size="sm" variant="ghost" className="h-8 text-xs gap-1">
            <Link href={`/occurrences/${occ.id}`}>
              <ExternalLink className="h-3.5 w-3.5" />
              Ver detalhes
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
