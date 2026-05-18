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
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Loader2, X } from "lucide-react";

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
  const [filterTerm, setFilterTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ ean: "", dun: "", internalCode: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState("");

  const filtered = useMemo(() => {
    const term = filterTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      p.description.toLowerCase().includes(term) ||
      p.internalCode.toLowerCase().includes(term) ||
      p.ean.toLowerCase().includes(term) ||
      (p.dun?.toLowerCase().includes(term) ?? false)
    );
  }, [products, filterTerm]);

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
      if (editing) {
        setProducts((prev) => prev.map((p) => p.id === editing.id
          ? { ...p, ean: form.ean, dun: form.dun || null, internalCode: form.internalCode, description: form.description }
          : p
        ));
      } else if (json.id) {
        setProducts((prev) => [...prev, {
          id: json.id!,
          ean: form.ean,
          dun: form.dun || null,
          internalCode: form.internalCode,
          description: form.description,
          active: true,
          currentPrice: null,
        }]);
      } else {
        router.refresh();
      }
    } catch { setError("Erro de rede"); }
    finally { setSaving(false); }
  };

  const toggleActive = async (p: Product) => {
    if (!user || !canManage || togglingId === p.id) return;
    setTogglingId(p.id);
    setToggleError("");
    const newActive = !p.active;
    setProducts((prev) => prev.map((product) => product.id === p.id ? { ...product, active: newActive } : product));
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { active: newActive } }),
      });
      if (!res.ok) {
        setProducts((prev) => prev.map((product) => product.id === p.id ? { ...product, active: p.active } : product));
        const json = await res.json() as { error?: string };
        setToggleError(String(json.error ?? "Erro ao atualizar status"));
      }
    } catch {
      setProducts((prev) => prev.map((product) => product.id === p.id ? { ...product, active: p.active } : product));
      setToggleError("Erro de rede ao atualizar status");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produtos</h1>
        {canManage && <Button onClick={openNew}><Plus className="h-4 w-4" />Novo Produto</Button>}
      </div>

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
          {filtered.length} de {products.length} produtos
        </span>
      </div>

      {toggleError && <p className="text-sm text-destructive">{toggleError}</p>}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
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
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6} className="text-center text-muted-foreground py-8">
                    Nenhum produto encontrado para este filtro.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.internalCode}</TableCell>
                    <TableCell className="text-sm font-medium">{p.description}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.ean}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.dun ?? "-"}</TableCell>
                    <TableCell className="text-sm">{p.currentPrice != null ? formatCurrency(p.currentPrice) : <span className="text-muted-foreground">Sem preço</span>}</TableCell>
                    <TableCell><Badge variant={p.active ? "success" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                    {canManage && (
                      <TableCell className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-10 w-10 p-0" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-10 px-3" onClick={() => toggleActive(p)} disabled={togglingId === p.id}>
                          {togglingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (p.active ? "Inativar" : "Ativar")}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
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
