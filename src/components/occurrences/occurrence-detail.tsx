"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/session-context";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { CheckCircle, Loader2, AlertTriangle, Trash2, Plus, Pencil, X, Check } from "lucide-react";

interface Status { id: string; name: string; isFinal: boolean }
interface Destination { id: string; name: string; description: string | null; requiresStorageLocation: boolean }
interface DamageType { id: string; name: string }

interface AuditLog {
  id: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  user: { name: string; email: string; role: string };
}

interface OccurrenceItem {
  id: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  batch: string | null;
  expirationDate: Date | null;
  product: { internalCode: string; description: string; ean: string };
  damageType: { name: string };
}

interface Occurrence {
  id: string;
  occurrenceCode: string;
  description: string;
  destinationObservation: string | null;
  storageLocation: string | null;
  notes: string | null;
  completedAt: Date | null;
  createdAt: Date;
  openedBy: { id: string; name: string; email: string; role: string };
  origin: { name: string };
  status: Status;
  destination: Destination | null;
  items: OccurrenceItem[];
  auditLogs: AuditLog[];
}

interface ProductSearchResult {
  id: string;
  internalCode: string;
  description: string;
  ean: string;
  unitValue: number | null;
}

interface ItemEditState {
  quantity: string;
  unitValue: string;
  saving: boolean;
}

export function OccurrenceDetail({
  occurrence: initial,
  statuses,
  destinations,
  damageTypes,
}: {
  occurrence: Occurrence;
  statuses: Status[];
  destinations: Destination[];
  damageTypes: DamageType[];
}) {
  const router = useRouter();
  const { user } = useSession();
  const [occ] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  const [statusId, setStatusId] = useState(occ.status.id);
  const [destinationId, setDestinationId] = useState(occ.destination?.id ?? "");
  const [notes, setNotes] = useState(occ.notes ?? "");
  const [storageLocation, setStorageLocation] = useState(occ.storageLocation ?? "");

  // --- Mutable items list ---
  const [items, setItems] = useState<OccurrenceItem[]>(initial.items);

  // --- Per-item edit state ---
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemEdit, setItemEdit] = useState<ItemEditState>({ quantity: "", unitValue: "", saving: false });
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // --- Add item panel ---
  const [showAddItem, setShowAddItem] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addSearchResults, setAddSearchResults] = useState<ProductSearchResult[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addProduct, setAddProduct] = useState<ProductSearchResult | null>(null);
  const [addQty, setAddQty] = useState("1");
  const [addUnitValue, setAddUnitValue] = useState("");
  const [addDamageTypeId, setAddDamageTypeId] = useState("");
  const [addBatch, setAddBatch] = useState("");
  const [addExpDate, setAddExpDate] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  // --- Delete occurrence ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedDestination = destinations.find((d) => d.id === destinationId);
  const requiresStorage = selectedDestination?.requiresStorageLocation ?? false;

  const canEdit = user ? hasPermission(user, "occurrence:edit_description") : false;
  const canEditStatus = user ? hasPermission(user, "occurrence:edit_status") : false;
  const canEditDestination = user ? hasPermission(user, "occurrence:edit_destination") : false;
  const canComplete = user ? hasPermission(user, "occurrence:complete") : false;
  const canEditItems = user ? hasPermission(user, "occurrence:edit_items") : false;
  const canDeleteOccurrence = user ? hasPermission(user, "occurrence:delete") : false;

  const totalValue = items.reduce((s, i) => s + i.totalValue, 0);
  const isCompleted = occ.status.isFinal;

  // ── Patch occurrence metadata ──────────────────────────────────────────────
  const patch = async (complete = false) => {
    if (!user) return;
    setError("");
    if (complete) setCompleting(true); else setSaving(true);

    try {
      const res = await fetch(`/api/occurrences/${occ.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            ...(canEditStatus && { statusId }),
            ...(canEditDestination && { destinationId: destinationId || null }),
            ...(canEdit && { notes: notes || null }),
            ...(requiresStorage && { storageLocation: storageLocation || null }),
            ...(!requiresStorage && { storageLocation: null }),
          },
          complete,
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setError(String(json.error ?? "Erro ao salvar")); return; }
      router.refresh();
    } catch { setError("Erro de rede"); }
    finally { setSaving(false); setCompleting(false); }
  };

  // ── Item editing ──────────────────────────────────────────────────────────
  const startEditItem = (item: OccurrenceItem) => {
    setEditingItemId(item.id);
    setItemEdit({ quantity: String(item.quantity), unitValue: String(item.unitValue), saving: false });
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
    setItemEdit({ quantity: "", unitValue: "", saving: false });
  };

  const saveItemEdit = async (itemId: string) => {
    setItemEdit((prev) => ({ ...prev, saving: true }));
    const qty = parseFloat(itemEdit.quantity);
    const unit = parseFloat(itemEdit.unitValue);
    if (isNaN(qty) || qty <= 0 || isNaN(unit) || unit < 0) {
      setItemEdit((prev) => ({ ...prev, saving: false }));
      return;
    }
    try {
      const res = await fetch(`/api/occurrences/${occ.id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty, unitValue: unit }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(String(json.error ?? "Erro ao salvar item"));
        setItemEdit((prev) => ({ ...prev, saving: false }));
        return;
      }
      const updated = await res.json() as OccurrenceItem;
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity: updated.quantity, unitValue: updated.unitValue, totalValue: updated.totalValue } : i)));
      setEditingItemId(null);
      setItemEdit({ quantity: "", unitValue: "", saving: false });
    } catch {
      setError("Erro de rede ao salvar item");
      setItemEdit((prev) => ({ ...prev, saving: false }));
    }
  };

  // ── Item deletion ─────────────────────────────────────────────────────────
  const deleteItem = async (itemId: string) => {
    setDeletingItemId(itemId);
    try {
      const res = await fetch(`/api/occurrences/${occ.id}/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(String(json.error ?? "Erro ao remover item"));
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      setError("Erro de rede ao remover item");
    } finally {
      setDeletingItemId(null);
    }
  };

  // ── Product search for add-item ───────────────────────────────────────────
  const searchProducts = async (q: string) => {
    if (q.length < 2) { setAddSearchResults([]); return; }
    setAddSearching(true);
    try {
      const res = await fetch(`/api/search/products?q=${encodeURIComponent(q)}`);
      const data = await res.json() as ProductSearchResult[];
      setAddSearchResults(Array.isArray(data) ? data : []);
    } catch { setAddSearchResults([]); }
    finally { setAddSearching(false); }
  };

  const selectAddProduct = async (p: ProductSearchResult) => {
    // Fetch current price for this product
    try {
      const res = await fetch(`/api/search/product?barcode=${encodeURIComponent(p.internalCode)}`);
      if (res.ok) {
        const full = await res.json() as ProductSearchResult;
        setAddProduct({ ...p, unitValue: full.unitValue });
        setAddUnitValue(full.unitValue != null ? String(full.unitValue) : "");
      } else {
        setAddProduct(p);
        setAddUnitValue(p.unitValue != null ? String(p.unitValue) : "");
      }
    } catch {
      setAddProduct(p);
      setAddUnitValue(p.unitValue != null ? String(p.unitValue) : "");
    }
    setAddSearch(p.description);
    setAddSearchResults([]);
  };

  const submitAddItem = async () => {
    if (!addProduct || !addDamageTypeId) {
      setAddError("Selecione o produto e o tipo de avaria");
      return;
    }
    const qty = parseFloat(addQty);
    const unit = parseFloat(addUnitValue);
    if (isNaN(qty) || qty <= 0) { setAddError("Quantidade inválida"); return; }
    if (isNaN(unit) || unit < 0) { setAddError("Valor unitário inválido"); return; }
    setAddError("");
    setAddSaving(true);
    try {
      const res = await fetch(`/api/occurrences/${occ.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: addProduct.id,
          quantity: qty,
          unitValue: unit,
          totalValue: Math.round(qty * unit * 100) / 100,
          damageTypeId: addDamageTypeId,
          batch: addBatch || undefined,
          expirationDate: addExpDate || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setAddError(String(json.error ?? "Erro ao adicionar produto"));
        return;
      }
      const newItem = await res.json() as OccurrenceItem;
      setItems((prev) => [...prev, newItem]);
      // Reset add form
      setShowAddItem(false);
      setAddProduct(null);
      setAddSearch("");
      setAddSearchResults([]);
      setAddQty("1");
      setAddUnitValue("");
      setAddDamageTypeId("");
      setAddBatch("");
      setAddExpDate("");
    } catch {
      setAddError("Erro de rede ao adicionar produto");
    } finally {
      setAddSaving(false);
    }
  };

  // ── Delete entire occurrence ──────────────────────────────────────────────
  const deleteOccurrence = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/occurrences/${occ.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(String(json.error ?? "Erro ao apagar ocorrência"));
        setShowDeleteConfirm(false);
        return;
      }
      router.push("/occurrences");
      router.refresh();
    } catch {
      setError("Erro de rede ao apagar ocorrência");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold font-mono">{occ.occurrenceCode}</h1>
          <p className="text-muted-foreground text-sm">Aberta por {occ.openedBy.name} em {formatDateTime(occ.createdAt)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canDeleteOccurrence && !isCompleted && !showDeleteConfirm && (
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Apagar Ocorrência
            </Button>
          )}
          {!isCompleted && canComplete && (
            <Button onClick={() => patch(true)} disabled={completing} variant="default">
              {completing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Concluir Ocorrência
            </Button>
          )}
          {!isCompleted && canEdit && (
            <Button onClick={() => patch(false)} disabled={saving} variant="outline">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Salvar
            </Button>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="flex items-center gap-3 p-4 border border-destructive/60 bg-destructive/10 rounded-md text-sm">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <span className="flex-1 font-medium text-destructive">
            Confirma apagar permanentemente a ocorrência <strong>{occ.occurrenceCode}</strong>? Esta ação não pode ser desfeita.
          </span>
          <Button variant="destructive" size="sm" onClick={deleteOccurrence} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
            Cancelar
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 border border-destructive/50 bg-destructive/10 rounded-md text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {isCompleted && (
        <div className="flex items-center gap-2 p-3 border border-green-200 bg-green-50 rounded-md text-sm text-green-800">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Ocorrência concluída em {formatDateTime(occ.completedAt)}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Dados Gerais</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Origem" value={occ.origin.name} />
            <Row label="Abertura" value={formatDateTime(occ.createdAt)} />
            {occ.completedAt && <Row label="Conclusão" value={formatDateTime(occ.completedAt)} />}
            <div className="space-y-1">
              <span className="text-muted-foreground">Descrição</span>
              <p className="text-foreground">{occ.description}</p>
            </div>
            {canEdit && (
              <div className="space-y-1.5">
                <Label className="text-xs">Observações</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} disabled={isCompleted} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Status e Destinação</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              {canEditStatus && !isCompleted ? (
                <Select value={statusId} onValueChange={setStatusId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary">{occ.status.name}</Badge>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Destinação</Label>
              {canEditDestination && !isCompleted ? (
                <Select value={destinationId} onValueChange={setDestinationId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar destinação" /></SelectTrigger>
                  <SelectContent>
                    {destinations.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm">{occ.destination?.name ?? "-"}</span>
              )}
            </div>

            {selectedDestination?.description && (
              <div className="p-3 bg-blue-50 rounded-md text-xs text-blue-800">
                {selectedDestination.description}
              </div>
            )}

            {requiresStorage && (
              <div className="space-y-1.5">
                <Label className="text-xs">Local de Armazenagem *</Label>
                <Input
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="Informe o local de armazenagem"
                  disabled={isCompleted}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Produtos Avariados ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Produtos Avariados</CardTitle>
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm">Total: {formatCurrency(totalValue)}</span>
              {canEditItems && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowAddItem((v) => !v); setAddError(""); }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Produto
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add-item form */}
          {showAddItem && canEditItems && (
            <div className="border rounded-md p-4 bg-muted/30 space-y-3">
              <p className="text-sm font-medium">Adicionar produto à ocorrência</p>

              {/* Product search */}
              <div className="space-y-1">
                <Label className="text-xs">Buscar produto (código, EAN ou descrição)</Label>
                <div className="relative">
                  <Input
                    value={addSearch}
                    onChange={(e) => {
                      setAddSearch(e.target.value);
                      setAddProduct(null);
                      searchProducts(e.target.value);
                    }}
                    placeholder="Digite para buscar…"
                  />
                  {addSearching && (
                    <Loader2 className="h-4 w-4 animate-spin absolute right-2 top-2.5 text-muted-foreground" />
                  )}
                </div>
                {addSearchResults.length > 0 && !addProduct && (
                  <div className="border rounded-md bg-background shadow-sm max-h-48 overflow-y-auto">
                    {addSearchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => selectAddProduct(p)}
                      >
                        <span className="font-mono text-xs text-muted-foreground mr-2">{p.internalCode}</span>
                        {p.description}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {addProduct && (
                <div className="text-xs text-muted-foreground bg-background border rounded px-3 py-2">
                  <span className="font-mono mr-2">{addProduct.internalCode}</span>
                  {addProduct.description}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de Avaria *</Label>
                  <Select value={addDamageTypeId} onValueChange={setAddDamageTypeId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {damageTypes.map((dt) => <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantidade *</Label>
                  <Input
                    type="number"
                    min="0.001"
                    step="1"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor Unitário (R$) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addUnitValue}
                    onChange={(e) => setAddUnitValue(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lote</Label>
                  <Input value={addBatch} onChange={(e) => setAddBatch(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Validade</Label>
                  <Input type="date" value={addExpDate} onChange={(e) => setAddExpDate(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>

              {addError && <p className="text-xs text-destructive">{addError}</p>}

              {addUnitValue && addQty && !isNaN(parseFloat(addQty)) && !isNaN(parseFloat(addUnitValue)) && (
                <p className="text-xs text-muted-foreground">
                  Total calculado: <strong>{formatCurrency(parseFloat(addQty) * parseFloat(addUnitValue))}</strong>
                </p>
              )}

              <div className="flex gap-2">
                <Button size="sm" onClick={submitAddItem} disabled={addSaving || !addProduct}>
                  {addSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Adicionar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowAddItem(false); setAddProduct(null); setAddSearch(""); setAddSearchResults([]); setAddError(""); }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Items table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo de Avaria</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Val. Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {canEditItems && <TableHead className="w-[80px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canEditItems ? 9 : 8} className="text-center text-sm text-muted-foreground py-6">
                      Nenhum produto vinculado.
                    </TableCell>
                  </TableRow>
                )}
                {items.map((item) => {
                  const isEditingThis = editingItemId === item.id;
                  const isDeletingThis = deletingItemId === item.id;

                  const previewQty = isEditingThis ? parseFloat(itemEdit.quantity) : item.quantity;
                  const previewUnit = isEditingThis ? parseFloat(itemEdit.unitValue) : item.unitValue;
                  const previewTotal = isEditingThis && !isNaN(previewQty) && !isNaN(previewUnit)
                    ? previewQty * previewUnit
                    : item.totalValue;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.product.internalCode}</TableCell>
                      <TableCell className="text-sm">{item.product.description}</TableCell>
                      <TableCell className="text-sm">{item.damageType.name}</TableCell>
                      <TableCell className="text-sm">{item.batch ?? "-"}</TableCell>
                      <TableCell className="text-sm">{formatDate(item.expirationDate)}</TableCell>

                      {/* Qty */}
                      <TableCell className="text-sm">
                        {isEditingThis ? (
                          <Input
                            type="number"
                            min="0.001"
                            step="1"
                            value={itemEdit.quantity}
                            onChange={(e) => setItemEdit((prev) => ({ ...prev, quantity: e.target.value }))}
                            className="h-7 w-20 text-xs"
                          />
                        ) : (
                          item.quantity
                        )}
                      </TableCell>

                      {/* Unit value */}
                      <TableCell className="text-sm">
                        {isEditingThis ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={itemEdit.unitValue}
                            onChange={(e) => setItemEdit((prev) => ({ ...prev, unitValue: e.target.value }))}
                            className="h-7 w-24 text-xs"
                          />
                        ) : (
                          formatCurrency(item.unitValue)
                        )}
                      </TableCell>

                      {/* Total (live preview when editing) */}
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(previewTotal)}
                      </TableCell>

                      {/* Actions */}
                      {canEditItems && (
                        <TableCell>
                          {isEditingThis ? (
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-green-600 hover:text-green-700"
                                onClick={() => saveItemEdit(item.id)}
                                disabled={itemEdit.saving}
                                title="Salvar"
                              >
                                {itemEdit.saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={cancelEditItem}
                                disabled={itemEdit.saving}
                                title="Cancelar"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => startEditItem(item)}
                                disabled={isDeletingThis || editingItemId !== null}
                                title="Editar quantidade/valor"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive/60 hover:text-destructive"
                                onClick={() => deleteItem(item.id)}
                                disabled={isDeletingThis || editingItemId !== null}
                                title="Remover produto"
                              >
                                {isDeletingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Histórico de Auditoria ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de Auditoria</CardTitle></CardHeader>
        <CardContent>
          {occ.auditLogs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro de auditoria.</p>}
          <div className="space-y-2">
            {occ.auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-sm p-2 rounded-md border bg-muted/20">
                <div className="shrink-0 text-muted-foreground text-xs">{formatDateTime(log.createdAt)}</div>
                <div className="flex-1">
                  <span className="font-medium">{log.user.name}</span>
                  <span className="text-muted-foreground"> ({log.user.role}) — </span>
                  <span>{log.action}</span>
                  {log.fieldName && (
                    <span className="text-muted-foreground"> · {log.fieldName}: </span>
                  )}
                  {log.oldValue && <span className="line-through text-muted-foreground">{log.oldValue} </span>}
                  {log.newValue && <span className="text-foreground font-medium">{log.newValue}</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
