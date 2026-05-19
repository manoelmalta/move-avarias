"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/session-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Search, Loader2, ScanBarcode } from "lucide-react";
import { BarcodeScannerDialog } from "@/components/barcode/barcode-scanner-dialog";

interface Origin { id: string; name: string }
interface DamageType { id: string; name: string }
interface ProductFound {
  id: string;
  internalCode: string;
  description: string;
  ean: string;
  dun: string | null;
  unitValue: number | null;
}

interface OccurrenceItem {
  productId: string;
  internalCode: string;
  description: string;
  barcodeInput: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  batch: string;
  expirationDate: string;
  damageTypeId: string;
}

export function NewOccurrenceForm({ origins, damageTypes }: { origins: Origin[]; damageTypes: DamageType[] }) {
  const router = useRouter();
  const { user } = useSession();

  const [originId, setOriginId] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OccurrenceItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [batch, setBatch] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [damageTypeId, setDamageTypeId] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundProduct, setFoundProduct] = useState<ProductFound | null>(null);
  const [productError, setProductError] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<ProductFound[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchSuggestions = useCallback(async (term: string) => {
    if (term.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/search/products?q=${encodeURIComponent(term)}`);
      if (!res.ok) { setSuggestions([]); return; }
      const data = await res.json() as ProductFound[];
      setSuggestions(data);
      setShowDropdown(data.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const handleBarcodeChange = (value: string) => {
    setBarcode(value);
    setFoundProduct(null);
    setProductError("");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length >= 3) {
      debounceRef.current = setTimeout(() => fetchSuggestions(value.trim()), 300);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  const selectSuggestion = (p: ProductFound) => {
    setFoundProduct(p);
    setBarcode(p.internalCode);
    setSuggestions([]);
    setShowDropdown(false);
    setProductError("");
  };

  const searchProduct = async () => {
    if (!barcode.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setShowDropdown(false);
    setSuggestions([]);
    setSearching(true);
    setProductError("");
    setFoundProduct(null);
    try {
      const res = await fetch(`/api/search/product?barcode=${encodeURIComponent(barcode.trim())}`);
      if (!res.ok) { setProductError("Produto não encontrado"); return; }
      const p = await res.json() as ProductFound;
      setFoundProduct(p);
    } catch { setProductError("Erro ao buscar produto"); }
    finally { setSearching(false); }
  };

  // ── Camera barcode handler ─────────────────────────────────────────────────

  const handleScanned = (code: string) => {
    setBarcode(code);
    setFoundProduct(null);
    setProductError("");
    setSuggestions([]);
    setShowDropdown(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Exact lookup via barcode — pass code directly, not through state
    async function lookup() {
      setSearching(true);
      try {
        const res = await fetch(`/api/search/product?barcode=${encodeURIComponent(code)}`);
        if (!res.ok) { setProductError("Produto não encontrado para o código lido."); return; }
        const p = await res.json() as ProductFound;
        setFoundProduct(p);
      } catch {
        setProductError("Erro ao buscar produto. Tente novamente.");
      } finally {
        setSearching(false);
      }
    }
    void lookup();
  };

  const addItem = () => {
    if (!foundProduct || !damageTypeId) return;
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setProductError("Informe uma quantidade válida.");
      return;
    }
    const unitValue = foundProduct.unitValue ?? 0;
    const totalValue = unitValue * parsedQuantity;
    setItems((prev) => [...prev, {
      productId: foundProduct.id,
      internalCode: foundProduct.internalCode,
      description: foundProduct.description,
      barcodeInput: barcode,
      quantity: parsedQuantity,
      unitValue,
      totalValue,
      batch,
      expirationDate,
      damageTypeId,
    }]);
    setBarcode(""); setQuantity("1"); setBatch(""); setExpirationDate(""); setDamageTypeId(""); setFoundProduct(null);
    setSuggestions([]); setShowDropdown(false);
  };

  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const totalOccurrenceValue = items.reduce((s, i) => s + i.totalValue, 0);

  const handleSubmit = async () => {
    if (!user) { setError("Usuário não selecionado"); return; }
    if (!originId || !description) { setError("Preencha origem e descrição"); return; }
    if (items.length === 0) { setError("Adicione pelo menos um produto"); return; }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/occurrences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            originId,
            description,
            notes: notes || undefined,
            items: items.map((i) => ({
              productId: i.productId,
              barcodeInput: i.barcodeInput || undefined,
              quantity: i.quantity,
              unitValue: i.unitValue,
              totalValue: i.totalValue,
              batch: i.batch || undefined,
              expirationDate: i.expirationDate || undefined,
              damageTypeId: i.damageTypeId,
            })),
          },
        }),
      });
      const data = await res.json() as { id: string; error?: string | { formErrors?: string[]; fieldErrors?: Record<string, string[]> } };
      if (!res.ok) {
        const err = data.error;
        if (typeof err === "string") {
          setError(err);
        } else if (err && typeof err === "object") {
          const first =
            err.formErrors?.[0] ??
            Object.values(err.fieldErrors ?? {})[0]?.[0] ??
            "Não foi possível salvar a ocorrência.";
          setError(first);
        } else {
          setError("Não foi possível salvar a ocorrência.");
        }
        return;
      }
      router.push(`/occurrences/${data.id}`);
    } catch { setError("Erro de rede"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Dados da Ocorrência</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Origem da Avaria *</Label>
              <Select value={originId} onValueChange={setOriginId}>
                <SelectTrigger><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
                <SelectContent>
                  {origins.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição da Ocorrência *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Descreva a ocorrência..." />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Observações adicionais..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Adicionar Produto</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div ref={containerRef} className="relative">
            <div className="flex gap-2">
              <Input
                placeholder="EAN / DUN / Código interno / Descrição..."
                value={barcode}
                onChange={(e) => handleBarcodeChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); searchProduct(); }
                  if (e.key === "Escape") { setShowDropdown(false); setSuggestions([]); }
                }}
                className="flex-1 h-12 text-base"
              />
              <Button
                type="button"
                variant="outline"
                onClick={searchProduct}
                disabled={searching}
                className="h-12 w-12 shrink-0 p-0"
                aria-label="Buscar produto"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setScannerOpen(true)}
                disabled={searching}
                className="h-12 w-12 shrink-0 p-0"
                aria-label="Ler código de barras pela câmera"
                title="Ler código de barras pela câmera"
              >
                <ScanBarcode className="h-5 w-5" />
              </Button>
            </div>

            {/* Autocomplete dropdown */}
            {showDropdown && (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-md border bg-popover shadow-md">
                {loadingSuggestions ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Buscando…
                  </div>
                ) : suggestions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum produto encontrado</p>
                ) : (
                  <ul className="max-h-64 overflow-y-auto py-1">
                    {suggestions.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                          onMouseDown={(e) => { e.preventDefault(); selectSuggestion(p); }}
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs shrink-0">{p.internalCode}</Badge>
                            <span className="text-sm font-medium truncate">{p.description}</span>
                            {p.unitValue != null && (
                              <span className="ml-auto text-xs text-muted-foreground shrink-0">{formatCurrency(p.unitValue)}</span>
                            )}
                          </div>
                          <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                            <span>EAN: {p.ean.startsWith("SEM-EAN-") ? "—" : p.ean}</span>
                            {p.dun && <span>DUN: {p.dun}</span>}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Loading indicator while fetching suggestions (no dropdown yet) */}
            {loadingSuggestions && !showDropdown && (
              <div className="absolute right-24 top-1/2 -translate-y-1/2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {productError && <p className="text-sm text-destructive">{productError}</p>}

          {foundProduct && (
            <div className="p-3 border rounded-md bg-muted/40 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="info">{foundProduct.internalCode}</Badge>
                <span className="font-medium">{foundProduct.description}</span>
                <span className="text-muted-foreground text-sm ml-auto">
                  {foundProduct.unitValue != null ? formatCurrency(foundProduct.unitValue) : "Sem preço"}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Quantidade *</Label>
                  <Input type="number" min="0.001" step="0.001" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor Unit.</Label>
                  <Input value={foundProduct.unitValue != null ? formatCurrency(foundProduct.unitValue) : ""} readOnly className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Lote</Label>
                  <Input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="Lote" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Validade</Label>
                  <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Avaria *</Label>
                <Select value={damageTypeId} onValueChange={setDamageTypeId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
                  <SelectContent>
                    {damageTypes.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Total: <strong>{formatCurrency((foundProduct.unitValue ?? 0) * (Number(quantity) || 0))}</strong></span>
                <Button type="button" onClick={addItem} disabled={!damageTypeId}>
                  <Plus className="h-4 w-4" />Adicionar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Produtos da Ocorrência</CardTitle>
              <span className="text-lg font-bold">Total: {formatCurrency(totalOccurrenceValue)}</span>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mobile card list */}
            <div className="md:hidden space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs shrink-0">
                          {item.internalCode}
                        </Badge>
                        <span className="text-sm font-medium truncate">{item.description}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {damageTypes.find((d) => d.id === item.damageTypeId)?.name}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-9 w-9"
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-sm tabular-nums">
                    <span className="text-muted-foreground">{item.quantity}x {formatCurrency(item.unitValue)}</span>
                    <span className="font-semibold">{formatCurrency(item.totalValue)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo Avaria</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Valor Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">{item.internalCode}</TableCell>
                      <TableCell className="text-sm">{item.description}</TableCell>
                      <TableCell className="text-sm">{damageTypes.find((d) => d.id === item.damageTypeId)?.name}</TableCell>
                      <TableCell className="text-sm">{item.quantity}</TableCell>
                      <TableCell className="text-sm">{formatCurrency(item.unitValue)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(item.totalValue)}</TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/occurrences")}>Cancelar</Button>
        <Button type="button" onClick={handleSubmit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar Ocorrência
        </Button>
      </div>

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleScanned}
      />
    </div>
  );
}
