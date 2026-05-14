import { prisma } from "@/lib/db/client";
import type { SessionUser } from "@/lib/auth/types";

interface AuditEntry {
  user: SessionUser;
  entityType: string;
  entityId: string;
  occurrenceId?: string;
  action: string;
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
}

export async function createAuditLog(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      clientId: entry.user.clientId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      occurrenceId: entry.occurrenceId ?? null,
      userId: entry.user.id,
      action: entry.action,
      fieldName: entry.fieldName ?? null,
      oldValue: entry.oldValue !== undefined ? String(entry.oldValue ?? "") : null,
      newValue: entry.newValue !== undefined ? String(entry.newValue ?? "") : null,
    },
  });
}

export async function auditFieldChanges(
  user: SessionUser,
  entityType: string,
  entityId: string,
  changes: Record<string, { old: unknown; new: unknown }>,
  occurrenceId?: string
): Promise<void> {
  const entries = Object.entries(changes).filter(
    ([, v]) => String(v.old ?? "") !== String(v.new ?? "")
  );
  await Promise.all(
    entries.map(([field, values]) =>
      createAuditLog({
        user,
        entityType,
        entityId,
        occurrenceId,
        action: "UPDATE",
        fieldName: field,
        oldValue: values.old != null ? String(values.old) : null,
        newValue: values.new != null ? String(values.new) : null,
      })
    )
  );
}
