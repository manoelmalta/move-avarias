"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/session-context";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Loader2 } from "lucide-react";

interface Product { id: string; internalCode: string; description: string }
interface Price {
  id: string;
  productId: string;
  unitValue: number;
  validFrom: Date;
  validTo: Date | null;
  sourceNote: string | null;
  product: { internalCode: string; description: string };
}

export function PricesManager({ products, prices: initial }: { products: Product[]; prices: Price[] }) {
  const router = useRouter();
  const { user } = useSession();
  const canManage = user ? hasPermission(user, "price:manage") : false;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ productId: "", unitValue: "", validFrom: "", validTo: "", sourceNote: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!user) return;
    const value = parseFloat(form.unitValue);
    if (!form.productId || isNaN(value) || !form.validFrom) { setError("Preencha produto, valor e data de início"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { productId: form.productId, unitValue: value, validFrom: form.validFrom, validTo: form.validTo || undefined, sourceNote: form.sourceNote || undefined } }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setError(String(json.error ?? "Erro ao salvar")); return; }
      setOpen(false);
      setForm({ productId: "", unitValue: "", validFrom: "", validTo: "", sourceNote: "" });
      router.refresh();
    } catch { setError("Erro de rede"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Preços de Produtos</h1>
        {canManage && <Button onClick={() => { setError(""); setOpen(true); }}><Plus className="h-4 w-4" />Novo Preço</Button>}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Valor Unit.</TableHead>
                <TableHead>Início Vigência</TableHead>
                <TableHead>Fim Vigência</TableHead>
                <TableHead>Fonte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initial.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm">{p.product.internalCode}</TableCell>
                  <TableCell className="text-sm">{p.product.description}</TableCell>
                  <TableCell className="text-sm font-medium">{formatCurrency(p.unitValue)}</TableCell>
                  <TableCell className="text-sm">{formatDate(p.validFrom)}</TableCell>
                  <TableCell className="text-sm">{formatDate(p.validTo)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.sourceNote ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Preço</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Produto *</Label>
              <Select value={form.productId} onValueChange={(v) => setForm((f) => ({ ...f, productId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.internalCode} — {p.description}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor Unitário (R$) *</Label>
                <Input type="number" step="0.01" value={form.unitValue} onChange={(e) => setForm((f) => ({ ...f, unitValue: e.target.value }))} placeholder="0,00" />
              </div>
              <div className="space-y-1.5">
                <Label>Início Vigência *</Label>
                <Input type="date" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Fim Vigência (opcional)</Label>
              <Input type="date" value={form.validTo} onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Fonte/Observação</Label>
              <Input value={form.sourceNote} onChange={(e) => setForm((f) => ({ ...f, sourceNote: e.target.value }))} placeholder="Ex: Tabela fornecedor Jan/2026" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
