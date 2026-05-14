"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/session-context";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Loader2 } from "lucide-react";

interface Product {
  id: string;
  ean: string;
  dun: string | null;
  internalCode: string;
  description: string;
  active: boolean;
  currentPrice: number | null;
}

export function ProductsManager({ products: initial }: { products: Product[] }) {
  const router = useRouter();
  const { user } = useSession();
  const canManage = user ? hasPermission(user, "product:manage") : false;

  const [products, setProducts] = useState(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ ean: "", dun: "", internalCode: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openNew = () => { setEditing(null); setForm({ ean: "", dun: "", internalCode: "", description: "" }); setError(""); setOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setForm({ ean: p.ean, dun: p.dun ?? "", internalCode: p.internalCode, description: p.description }); setError(""); setOpen(true); };

  const save = async () => {
    if (!user) return;
    setSaving(true); setError("");
    try {
      const res = editing
        ? await fetch(`/api/products/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: form }) })
        : await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: form }) });

      const json = await res.json() as { error?: string; id?: string };
      if (!res.ok) { setError(String(json.error ?? "Erro ao salvar")); return; }
      setOpen(false);
      router.refresh();
    } catch { setError("Erro de rede"); }
    finally { setSaving(false); }
  };

  const toggleActive = async (p: Product) => {
    if (!user || !canManage) return;
    await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { active: !p.active } }),
    });
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produtos</h1>
        {canManage && <Button onClick={openNew}><Plus className="h-4 w-4" />Novo Produto</Button>}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>EAN</TableHead>
                <TableHead>DUN</TableHead>
                <TableHead>Preço Vigente</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm">{p.internalCode}</TableCell>
                  <TableCell className="text-sm font-medium">{p.description}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.ean}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.dun ?? "-"}</TableCell>
                  <TableCell className="text-sm">{p.currentPrice != null ? formatCurrency(p.currentPrice) : <span className="text-muted-foreground">Sem preço</span>}</TableCell>
                  <TableCell><Badge variant={p.active ? "success" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                  {canManage && (
                    <TableCell className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(p)}>{p.active ? "Inativar" : "Ativar"}</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>EAN *</Label>
                <Input value={form.ean} onChange={(e) => setForm((f) => ({ ...f, ean: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>DUN</Label>
                <Input value={form.dun} onChange={(e) => setForm((f) => ({ ...f, dun: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Código Interno *</Label>
              <Input value={form.internalCode} onChange={(e) => setForm((f) => ({ ...f, internalCode: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
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
