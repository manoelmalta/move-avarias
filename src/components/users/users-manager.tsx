"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/utils";
import { Plus, Pencil, KeyRound, Loader2, UserCheck, UserX, ShieldCheck, ShieldAlert, RotateCcw } from "lucide-react";
import type { UserRole } from "@/lib/auth/types";
import type { Permission } from "@/lib/permissions";
import { PERMISSION_MODULES, PERMISSION_LABELS, ROLE_PERMISSIONS } from "@/lib/permissions";
import { isProtectedAdmin } from "@/lib/protected-users";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface PermissionEntry {
  permission: string;
  roleDefault: boolean;
  overrideValue: boolean | null;
  effective: boolean;
}

type DialogMode = "none" | "create" | "edit" | "reset-password" | "permissions";

const ROLES: UserRole[] = ["SEPARADOR", "LIDER", "ANALISTA", "GESTOR", "ADMIN"];

const roleLabels: Record<UserRole, string> = {
  SEPARADOR: "Separador",
  LIDER: "Líder",
  ANALISTA: "Analista",
  GESTOR: "Gestor",
  ADMIN: "Administrador",
};

const roleVariants: Record<UserRole, "secondary" | "warning" | "info" | "default" | "destructive"> = {
  SEPARADOR: "secondary",
  LIDER: "warning",
  ANALISTA: "info",
  GESTOR: "default",
  ADMIN: "destructive",
};

function friendlyError(status: number, msg: string): string {
  if (msg.includes("inativar sua própria")) return "Não é possível inativar o próprio usuário administrador.";
  if (msg.includes("pelo menos um ADMIN")) return "Não é possível remover o último administrador ativo.";
  if (msg.includes("Email já cadastrado")) return "Já existe um usuário com este e-mail.";
  if (msg.includes("administrador é protegido")) return msg;
  if (status === 403) return "Ação não permitida para este usuário.";
  if (status === 409) return msg;
  return msg || "Erro inesperado. Tente novamente.";
}

export function UsersManager({ users: initial, currentUserId }: { users: User[]; currentUserId: string }) {
  const router = useRouter();
  const [dialogMode, setDialogMode] = useState<DialogMode>("none");
  const [selected, setSelected] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [createForm, setCreateForm] = useState({ name: "", email: "", role: "" as UserRole | "", password: "", confirm: "" });
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "" as UserRole | "", active: true });
  const [resetForm, setResetForm] = useState({ password: "", confirm: "" });

  // Permissions panel state
  const [permEntries, setPermEntries] = useState<PermissionEntry[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permOverrides, setPermOverrides] = useState<Record<string, boolean>>({});
  const [permRole, setPermRole] = useState<UserRole>("SEPARADOR");

  const openCreate = () => {
    setCreateForm({ name: "", email: "", role: "", password: "", confirm: "" });
    setError(""); setSuccess("");
    setDialogMode("create");
  };

  const openEdit = (u: User) => {
    setSelected(u);
    setEditForm({ name: u.name, email: u.email, role: u.role as UserRole, active: u.active });
    setError(""); setSuccess("");
    setDialogMode("edit");
  };

  const openReset = (u: User) => {
    setSelected(u);
    setResetForm({ password: "", confirm: "" });
    setError(""); setSuccess("");
    setDialogMode("reset-password");
  };

  const openPermissions = useCallback(async (u: User) => {
    setSelected(u);
    setError(""); setSuccess("");
    setPermLoading(true);
    setPermEntries([]);
    setDialogMode("permissions");

    try {
      const res = await fetch(`/api/users/${u.id}/permissions`);
      const json = await res.json() as { role: UserRole; permissions: PermissionEntry[] };
      if (res.ok) {
        setPermRole(json.role);
        setPermEntries(json.permissions);
        const overrides: Record<string, boolean> = {};
        for (const e of json.permissions) {
          if (e.overrideValue !== null) overrides[e.permission] = e.overrideValue;
        }
        setPermOverrides(overrides);
      } else {
        setError("Erro ao carregar permissões.");
      }
    } catch {
      setError("Erro de rede ao carregar permissões.");
    } finally {
      setPermLoading(false);
    }
  }, []);

  const closeDialog = () => { setDialogMode("none"); setSelected(null); setError(""); setSuccess(""); };

  const handleCreate = async () => {
    const { name, email, role, password, confirm } = createForm;
    if (!name.trim() || name.trim().length < 2) { setError("Nome deve ter pelo menos 2 caracteres."); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("E-mail inválido."); return; }
    if (!role) { setError("Selecione um perfil."); return; }
    if (password.length < 8) { setError("Senha deve ter pelo menos 8 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não coincidem."); return; }

    setSaving(true); setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), role, password }),
      });
      const json = await res.json() as { error?: string | Record<string, unknown> };
      if (!res.ok) {
        const msg = typeof json.error === "string" ? json.error : "Dados inválidos.";
        setError(friendlyError(res.status, msg));
        return;
      }
      closeDialog();
      router.refresh();
    } catch { setError("Erro de rede. Tente novamente."); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!selected) return;
    const { name, email, role, active } = editForm;
    if (!name.trim() || name.trim().length < 2) { setError("Nome deve ter pelo menos 2 caracteres."); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("E-mail inválido."); return; }
    if (!role) { setError("Selecione um perfil."); return; }

    const body: Record<string, unknown> = {};
    if (name.trim() !== selected.name) body.name = name.trim();
    if (email.trim().toLowerCase() !== selected.email) body.email = email.trim().toLowerCase();
    if (role !== selected.role) body.role = role;
    if (active !== selected.active) body.active = active;
    if (Object.keys(body).length === 0) { closeDialog(); return; }

    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/users/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(friendlyError(res.status, json.error ?? ""));
        return;
      }
      closeDialog();
      router.refresh();
    } catch { setError("Erro de rede. Tente novamente."); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (u: User) => {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !u.active }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(friendlyError(res.status, json.error ?? ""));
        return;
      }
      router.refresh();
    } catch { setError("Erro de rede. Tente novamente."); }
    finally { setSaving(false); }
  };

  const handleResetPassword = async () => {
    if (!selected) return;
    const { password, confirm } = resetForm;
    if (password.length < 8) { setError("Senha deve ter pelo menos 8 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não coincidem."); return; }

    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/users/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(friendlyError(res.status, json.error ?? ""));
        return;
      }
      setSuccess(`Senha de ${selected.name} redefinida com sucesso.`);
      setResetForm({ password: "", confirm: "" });
    } catch { setError("Erro de rede. Tente novamente."); }
    finally { setSaving(false); }
  };

  const togglePermission = (perm: Permission) => {
    setPermOverrides((prev) => {
      const roleDefault = ROLE_PERMISSIONS[permRole]?.includes(perm) ?? false;
      const currentEffective = perm in prev ? prev[perm] : roleDefault;
      const next = !currentEffective;

      if (next === roleDefault) {
        const copy = { ...prev };
        delete copy[perm];
        return copy;
      }
      return { ...prev, [perm]: next };
    });
  };

  const handleResetPermissions = async () => {
    if (!selected) return;
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/users/${selected.id}/permissions`, { method: "DELETE" });
      if (!res.ok) { setError("Erro ao restaurar permissões."); return; }
      setPermOverrides({});
      setPermEntries((prev) =>
        prev.map((e) => ({ ...e, overrideValue: null, effective: e.roleDefault }))
      );
      setSuccess("Permissões restauradas ao padrão do perfil.");
    } catch { setError("Erro de rede. Tente novamente."); }
    finally { setSaving(false); }
  };

  const handleSavePermissions = async () => {
    if (!selected) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/users/${selected.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: permOverrides }),
      });
      if (!res.ok) { setError("Erro ao salvar permissões."); return; }
      setSuccess("Permissões salvas. O usuário precisará fazer login novamente para aplicar as mudanças.");
    } catch { setError("Erro de rede. Tente novamente."); }
    finally { setSaving(false); }
  };

  const hasCustomizations = Object.keys(permOverrides).length > 0;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie os usuários e perfis de acesso do sistema.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Novo Usuário</Button>
      </div>

      {error && !dialogMode && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{error}</p>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Atualizado em</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initial.map((u) => {
                const isProtected = isProtectedAdmin(u.email);
                return (
                  <TableRow key={u.id} className={!u.active ? "opacity-60" : undefined}>
                    <TableCell className="font-medium text-sm">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {u.name}
                        {u.id === currentUserId && (
                          <span className="text-xs text-muted-foreground">(você)</span>
                        )}
                        {isProtected && (
                          <Badge
                            variant="outline"
                            className="text-xs gap-1 border-amber-400 text-amber-700 bg-amber-50"
                            title="Administrador protegido do sistema."
                          >
                            <ShieldCheck className="h-3 w-3" />
                            Admin protegido
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleVariants[u.role as UserRole] ?? "secondary"}>
                        {roleLabels[u.role as UserRole] ?? u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.active ? "success" : "secondary"}>{u.active ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(u.createdAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(u.updatedAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-10 w-10 p-0"
                          onClick={() => openEdit(u)}
                          disabled={isProtected}
                          title={isProtected ? "Administrador protegido do sistema." : "Editar"}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-10 w-10 p-0"
                          onClick={() => void openPermissions(u)}
                          disabled={u.id === currentUserId || isProtected}
                          title={
                            u.id === currentUserId
                              ? "Não é permitido editar as próprias permissões."
                              : isProtected
                                ? "Administrador protegido do sistema."
                                : "Gerenciar permissões"
                          }
                        >
                          <ShieldAlert className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-10 w-10 p-0"
                          onClick={() => handleToggleActive(u)}
                          disabled={isProtected}
                          title={
                            isProtected
                              ? "Administrador protegido do sistema."
                              : u.active
                                ? "Inativar"
                                : "Ativar"
                          }
                        >
                          {u.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-10 w-10 p-0"
                          onClick={() => openReset(u)}
                          title="Redefinir senha"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: Criar usuário */}
      <Dialog open={dialogMode === "create"} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} placeholder="usuario@exemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil *</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar perfil" /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Senha inicial *</Label>
              <Input type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar senha *</Label>
              <Input type="password" value={createForm.confirm} onChange={(e) => setCreateForm((f) => ({ ...f, confirm: e.target.value }))} placeholder="Repita a senha" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog} disabled={saving}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}Criar Usuário
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar usuário */}
      <Dialog open={dialogMode === "edit"} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil *</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label>Status</Label>
              <Button
                type="button"
                size="sm"
                variant={editForm.active ? "outline" : "secondary"}
                onClick={() => setEditForm((f) => ({ ...f, active: !f.active }))}
              >
                {editForm.active ? <><UserCheck className="h-3.5 w-3.5 mr-1" />Ativo</> : <><UserX className="h-3.5 w-3.5 mr-1" />Inativo</>}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog} disabled={saving}>Cancelar</Button>
              <Button onClick={handleEdit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Redefinir senha */}
      <Dialog open={dialogMode === "reset-password"} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha{selected ? ` — ${selected.name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {success ? (
              <>
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">{success}</p>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={closeDialog}>Fechar</Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Nova senha *</Label>
                  <Input type="password" value={resetForm.password} onChange={(e) => setResetForm((f) => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirmar nova senha *</Label>
                  <Input type="password" value={resetForm.confirm} onChange={(e) => setResetForm((f) => ({ ...f, confirm: e.target.value }))} placeholder="Repita a nova senha" />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closeDialog} disabled={saving}>Cancelar</Button>
                  <Button onClick={handleResetPassword} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}Redefinir
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Permissões */}
      <Dialog open={dialogMode === "permissions"} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Permissões{selected ? ` — ${selected.name}` : ""}
            </DialogTitle>
          </DialogHeader>

          {permLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                <span>Perfil base:</span>
                <Badge variant={roleVariants[permRole] ?? "secondary"}>
                  {roleLabels[permRole] ?? permRole}
                </Badge>
                {hasCustomizations && (
                  <span className="ml-auto text-amber-600 font-medium text-xs flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    {Object.keys(permOverrides).length} permissão(ões) personalizada(s)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm border-2 border-amber-400 bg-amber-50" />
                  Personalizada
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm border-2 border-border" />
                  Padrão do perfil
                </span>
              </div>

              {PERMISSION_MODULES.map((module, mi) => {
                const modulePerms = module.permissions.map((perm) => {
                  const entry = permEntries.find((e) => e.permission === perm);
                  const roleDefault = ROLE_PERMISSIONS[permRole]?.includes(perm) ?? false;
                  const isOverridden = perm in permOverrides;
                  const effective = isOverridden ? permOverrides[perm] : (entry?.effective ?? roleDefault);
                  return { perm, roleDefault, isOverridden, effective };
                });

                return (
                  <div key={module.label}>
                    {mi > 0 && <Separator className="my-3" />}
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {module.label}
                    </p>
                    <div className="space-y-1">
                      {modulePerms.map(({ perm, roleDefault, isOverridden, effective }) => (
                        <label
                          key={perm}
                          className={`flex items-center gap-3 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
                            isOverridden ? "border border-amber-300 bg-amber-50/50" : ""
                          }`}
                        >
                          <Checkbox
                            checked={effective}
                            onCheckedChange={() => togglePermission(perm as Permission)}
                          />
                          <span className="text-sm flex-1">
                            {PERMISSION_LABELS[perm as Permission] ?? perm}
                          </span>
                          {isOverridden && (
                            <span className="text-xs text-amber-700 shrink-0">
                              {roleDefault ? "removida do perfil" : "adicionada ao perfil"}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}

              {success && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  {success}
                </p>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleResetPermissions()}
                  disabled={saving || !hasCustomizations}
                  title="Restaurar padrão do perfil"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Restaurar padrão
                </Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={closeDialog} disabled={saving}>Fechar</Button>
                <Button onClick={() => void handleSavePermissions()} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar permissões
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
