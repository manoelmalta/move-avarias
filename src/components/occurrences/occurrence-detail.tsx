"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/session-context";
import { hasPermission, canEditOccurrence } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { CheckCircle, Loader2, AlertTriangle } from "lucide-react";

interface Status { id: string; name: string; isFinal: boolean }
interface Destination { id: string; name: string; description: string | null; requiresStorageLocation: boolean }

interface AuditLog {
  id: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  user: { name: string; email: string; role: string };
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
  items: {
    id: string;
    quantity: number;
    unitValue: number;
    totalValue: number;
    batch: string | null;
    expirationDate: Date | null;
    product: { internalCode: string; description: string; ean: string };
    damageType: { name: string };
  }[];
  auditLogs: AuditLog[];
}

export function OccurrenceDetail({
  occurrence: initial,
  statuses,
  destinations,
}: {
  occurrence: Occurrence;
  statuses: Status[];
  destinations: Destination[];
}) {
  const router = useRouter();
  const { user } = useSession();
  const [occ, setOcc] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  const [statusId, setStatusId] = useState(occ.status.id);
  const [destinationId, setDestinationId] = useState(occ.destination?.id ?? "");
  const [notes, setNotes] = useState(occ.notes ?? "");
  const [storageLocation, setStorageLocation] = useState(occ.storageLocation ?? "");

  const selectedDestination = destinations.find((d) => d.id === destinationId);
  const requiresStorage = selectedDestination?.requiresStorageLocation ?? false;

  const canEdit = user ? canEditOccurrence(user, occ.openedBy.id) : false;
  const canEditStatus = user ? hasPermission(user, "occurrence:edit_status") : false;
  const canEditDestination = user ? hasPermission(user, "occurrence:edit_destination") : false;
  const canComplete = user ? hasPermission(user, "occurrence:complete") : false;

  const totalValue = occ.items.reduce((s, i) => s + i.totalValue, 0);
  const isCompleted = occ.status.isFinal;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono">{occ.occurrenceCode}</h1>
          <p className="text-muted-foreground text-sm">Aberta por {occ.openedBy.name} em {formatDateTime(occ.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          {!isCompleted && canComplete && (
            <Button onClick={() => patch(true)} disabled={completing} variant="default">
              {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Concluir Ocorrência
            </Button>
          )}
          {!isCompleted && canEdit && (
            <Button onClick={() => patch(false)} disabled={saving} variant="outline">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          )}
        </div>
      </div>

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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Produtos Avariados</CardTitle>
            <span className="font-bold">Total: {formatCurrency(totalValue)}</span>
          </div>
        </CardHeader>
        <CardContent>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {occ.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.product.internalCode}</TableCell>
                  <TableCell className="text-sm">{item.product.description}</TableCell>
                  <TableCell className="text-sm">{item.damageType.name}</TableCell>
                  <TableCell className="text-sm">{item.batch ?? "-"}</TableCell>
                  <TableCell className="text-sm">{formatDate(item.expirationDate)}</TableCell>
                  <TableCell className="text-sm">{item.quantity}</TableCell>
                  <TableCell className="text-sm">{formatCurrency(item.unitValue)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatCurrency(item.totalValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
