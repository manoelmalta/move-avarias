"use client";
import { useState } from "react";
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
import { Plus, Trash2, Search, Loader2 } from "lucide-react";

interface Origin { id: string; name: string }
interface DamageType { id: string; name: string }
interface ProductFound { id: string; internalCode: string; description: string; ean: string; dun: string | null; unitValue: number | null }

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
  const [quantity, setQuantity] = useState(1);
  const [batch, setBatch] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [damageTypeId, setDamageTypeId] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundProduct, setFoundProduct] = useState<ProductFound | null>(null);
  const [productError, setProductError] = useState("");

  const searchProduct = async () => {
    if (!barcode.trim()) return;
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

  const addItem = () => {
    if (!foundProduct || !damageTypeId) return;
    const unitValue = foundProduct.unitValue ?? 0;
    const totalValue = unitValue * quantity;
    setItems((prev) => [...prev, {
      productId: foundProduct.id,
      internalCode: foundProduct.internalCode,
      description: foundProduct.description,
      barcodeInput: barcode,
      quantity,
      unitValue,
      totalValue,
      batch,
      expirationDate,
      damageTypeId,
    }]);
    setBarcode(""); setQuantity(1); setBatch(""); setExpirationDate(""); setDamageTypeId(""); setFoundProduct(null);
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
      const data = await res.json() as { id: string; error?: string };
      if (!res.ok) { setError(String(data.error ?? "Erro ao salvar")); return; }
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
          <div className="flex gap-2">
            <Input
              placeholder="EAN / DUN / Código interno..."
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchProduct()}
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={searchProduct} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
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
                  <Input type="number" min={0.001} step={0.001} value={quantity} onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)} />
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
                <span className="text-sm">Total: <strong>{formatCurrency((foundProduct.unitValue ?? 0) * quantity)}</strong></span>
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
    </div>
  );
}
