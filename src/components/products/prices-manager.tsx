"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/session-context";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";

interface Product {
  id: string;
  internalCode: string;
  description: string;
  ean: string;
  dun: string | null;
}

interface Price {
  id: string;
  productId: string;
  unitValue: number;
  validFrom: string | Date;
  validTo: string | Date | null;
  sourceNote: string | null;
  product: { internalCode: string; description: string; ean: string; dun: string | null };
}

interface NextPrice {
  unitValue: number;
  validFrom: string;
}

interface Props {
  products: Product[];
  prices: Price[];
  currentPriceMap: Record<string, number>;
  nextPriceMap: Record<string, NextPrice>;
}

function flattenZodError(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    // Zod flatten shape: { formErrors: string[], fieldErrors: { field: string[] } }
    if (Array.isArray(e.formErrors) && (e.formErrors as string[]).length > 0) {
      return (e.formErrors as string[]).join(", ");
    }
    if (e.fieldErrors && typeof e.fieldErrors === "object") {
      const msgs = Object.values(e.fieldErrors as Record<string, string[]>)
        .flat()
        .filter(Boolean);
      if (msgs.length > 0) return msgs.join(", ");
    }
  }
  return "Erro ao salvar";
}

export function PricesManager({ products, prices: initial, currentPriceMap, nextPriceMap }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const canManage = user ? hasPermission(user, "price:manage") : false;

  // ── Filtro/busca ──────────────────────────────────────────────────────────
  const [filterTerm, setFilterTerm] = useState("");

  // ── Diálogo de novo preço ─────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [prefilledProductId, setPrefilledProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [form, setForm] = useState({ productId: "", unitValue: "", validFrom: "", sourceNote: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Listagem filtrada ─────────────────────────────────────────────────────
  const filteredPrices = useMemo(() => {
    const term = filterTerm.trim().toLowerCase();
    if (!term) return initial;
    return initial.filter((p) =>
      p.product.description.toLowerCase().includes(term) ||
      p.product.internalCode.toLowerCase().includes(term) ||
      p.product.ean.toLowerCase().includes(term) ||
      (p.product.dun?.toLowerCase().includes(term) ?? false)
    );
  }, [initial, filterTerm]);

  // ── Produtos filtrados no seletor do diálogo ──────────────────────────────
  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      p.description.toLowerCase().includes(term) ||
      p.internalCode.toLowerCase().includes(term) ||
      p.ean.toLowerCase().includes(term) ||
      (p.dun?.toLowerCase().includes(term) ?? false)
    );
  }, [products, productSearch]);

  const selectedProduct = products.find((p) => p.id === form.productId);

  const openNew = (productId = "") => {
    setForm({ productId, unitValue: "", validFrom: "", sourceNote: "" });
    setProductSearch(productId ? (products.find((p) => p.id === productId)?.internalCode ?? "") : "");
    setPrefilledProductId(productId);
    setProductDropdownOpen(false);
    setError("");
    setOpen(true);
  };

  const save = async () => {
    if (!user) return;
    const value = parseFloat(form.unitValue);
    if (!form.productId) { setError("Selecione um produto"); return; }
    if (isNaN(value) || value < 0) { setError("Informe um valor válido (≥ 0)"); return; }
    if (!form.validFrom) { setError("Informe a data de início de vigência"); return; }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            productId: form.productId,
            unitValue: value,
            validFrom: form.validFrom,
            sourceNote: form.sourceNote || undefined,
          },
        }),
      });
      const json = await res.json() as { error?: unknown };
      if (!res.ok) {
        setError(flattenZodError(json.error) ?? "Erro ao salvar");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Erro de rede — verifique sua conexão e tente novamente");
    } finally {
      setSaving(false);
    }
  };

  // ── Label de status do preço ──────────────────────────────────────────────
  const priceStatus = (price: Price): "vigente" | "futuro" | "expirado" => {
    const now = new Date();
    const vf = new Date(price.validFrom);
    const vt = price.validTo ? new Date(price.validTo) : null;
    if (vf > now) return "futuro";
    if (vt !== null && vt < now) return "expirado";
    return "vigente";
  };

  return (
    <>
      {/* ── Cabeçalho ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Preços de Produtos</h1>
        {canManage && (
          <Button onClick={() => openNew()}>
            <Plus className="h-4 w-4" />
            Novo Preço
          </Button>
        )}
      </div>

      {/* ── Barra de busca ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Buscar por descrição, código, EAN ou DUN..."
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
          />
          {filterTerm && (
            <button
              type="button"
              onClick={() => setFilterTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar filtro"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filteredPrices.length} de {initial.length} registros
        </span>
      </div>

      {/* ── Tabela de preços ── */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>EAN</TableHead>
                <TableHead>Valor Unit.</TableHead>
                <TableHead>Início Vigência</TableHead>
                <TableHead>Fim Vigência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fonte</TableHead>
                {canManage && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 9 : 8} className="text-center text-muted-foreground py-8">
                    {filterTerm ? "Nenhum preço encontrado para este filtro." : "Nenhum preço cadastrado."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPrices.map((p) => {
                  const status = priceStatus(p);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm">{p.product.internalCode}</TableCell>
                      <TableCell className="text-sm font-medium">{p.product.description}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.product.ean}</TableCell>
                      <TableCell className="text-sm font-medium">{formatCurrency(p.unitValue)}</TableCell>
                      <TableCell className="text-sm">{formatDate(p.validFrom)}</TableCell>
                      <TableCell className="text-sm">{formatDate(p.validTo)}</TableCell>
                      <TableCell>
                        {status === "vigente" && <Badge variant="success">Vigente</Badge>}
                        {status === "futuro" && <Badge variant="secondary">Futuro</Badge>}
                        {status === "expirado" && <Badge variant="outline">Expirado</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.sourceNote ?? "-"}</TableCell>
                      {canManage && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            onClick={() => openNew(p.productId)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Novo preço
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Resumo por produto (preço atual + próximo programado) ── */}
      {Object.keys(currentPriceMap).length > 0 || Object.keys(nextPriceMap).length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Resumo de vigência por produto
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {products
              .filter((p) => currentPriceMap[p.id] !== undefined || nextPriceMap[p.id] !== undefined)
              .map((p) => {
                const current = currentPriceMap[p.id];
                const next = nextPriceMap[p.id];
                return (
                  <Card key={p.id} className="p-3">
                    <p className="text-xs text-muted-foreground font-mono">{p.internalCode}</p>
                    <p className="text-sm font-medium leading-tight">{p.description}</p>
                    <div className="mt-2 space-y-1">
                      {current !== undefined && (
                        <div className="flex items-center gap-2">
                          <Badge variant="success" className="text-xs">Vigente</Badge>
                          <span className="text-sm font-semibold">{formatCurrency(current)}</span>
                        </div>
                      )}
                      {next && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">A partir de {formatDate(next.validFrom)}</Badge>
                          <span className="text-sm">{formatCurrency(next.unitValue)}</span>
                        </div>
                      )}
                    </div>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 text-xs w-full"
                        onClick={() => openNew(p.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Novo preço
                      </Button>
                    )}
                  </Card>
                );
              })}
          </div>
        </div>
      ) : null}

      {/* ── Diálogo: novo preço ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Preço</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">

            {/* Seletor de produto com busca */}
            <div className="space-y-1.5">
              <Label>Produto *</Label>
              <div className="relative">
                <div
                  className="flex items-center justify-between border rounded-md px-3 h-10 cursor-pointer bg-background hover:bg-accent transition-colors"
                  onClick={() => {
                    if (!prefilledProductId) setProductDropdownOpen((v) => !v);
                  }}
                >
                  <span className={selectedProduct ? "text-sm" : "text-sm text-muted-foreground"}>
                    {selectedProduct
                      ? `${selectedProduct.internalCode} — ${selectedProduct.description}`
                      : "Selecionar produto"}
                  </span>
                  {!prefilledProductId && (
                    productDropdownOpen
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {productDropdownOpen && !prefilledProductId && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                    <div className="p-2 border-b">
                      <Input
                        autoFocus
                        placeholder="Buscar por descrição, código, EAN ou DUN..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto encontrado</p>
                      ) : (
                        filteredProducts.map((p) => (
                          <div
                            key={p.id}
                            className="px-3 py-2 cursor-pointer hover:bg-accent text-sm"
                            onClick={() => {
                              setForm((f) => ({ ...f, productId: p.id }));
                              setProductDropdownOpen(false);
                              setProductSearch("");
                            }}
                          >
                            <span className="font-mono text-xs text-muted-foreground mr-2">{p.internalCode}</span>
                            {p.description}
                            <span className="text-xs text-muted-foreground ml-2">EAN {p.ean}</span>
                            {p.dun && <span className="text-xs text-muted-foreground ml-1">· DUN {p.dun}</span>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Mostra preço atual do produto selecionado */}
              {selectedProduct && currentPriceMap[selectedProduct.id] !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Preço vigente atual: <span className="font-medium text-foreground">{formatCurrency(currentPriceMap[selectedProduct.id])}</span>
                </p>
              )}
            </div>

            {/* Valor e data */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor Unitário (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unitValue}
                  onChange={(e) => setForm((f) => ({ ...f, unitValue: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Início de Vigência *</Label>
                <Input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                />
              </div>
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <Label>Fonte / Observação</Label>
              <Input
                value={form.sourceNote}
                onChange={(e) => setForm((f) => ({ ...f, sourceNote: e.target.value }))}
                placeholder="Ex: Tabela fornecedor Jan/2026"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
