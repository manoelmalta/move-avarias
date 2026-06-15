import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { ROLE_PERMISSIONS, ALL_PERMISSIONS } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";
import type { UserRole } from "@/lib/auth/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      role: true,
      permissionOverrides: { select: { permission: true, granted: true } },
    },
  });

  if (!target || target.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const overrides = Object.fromEntries(
    target.permissionOverrides.map((o) => [o.permission, o.granted])
  );

  const roleDefaults = new Set(ROLE_PERMISSIONS[target.role as UserRole] ?? []);

  const permissions = ALL_PERMISSIONS.map((perm) => {
    const hasOverride = perm in overrides;
    const roleDefault = roleDefaults.has(perm);
    const effective = hasOverride ? overrides[perm] : roleDefault;
    return {
      permission: perm,
      roleDefault,
      overrideValue: hasOverride ? overrides[perm] : null,
      effective,
    };
  });

  return NextResponse.json({ role: target.role, permissions });
}

const SavePermissionsSchema = z.object({
  overrides: z.record(z.string(), z.boolean()),
});

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Não é permitido editar as próprias permissões." },
      { status: 403 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      role: true,
      permissionOverrides: { select: { permission: true, granted: true } },
    },
  });

  if (!target || target.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const body = await req.json() as unknown;
  const parsed = SavePermissionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { overrides } = parsed.data;

  // Only allow known permissions
  const validKeys = new Set<string>(ALL_PERMISSIONS);
  const sanitized = Object.fromEntries(
    Object.entries(overrides).filter(([k]) => validKeys.has(k))
  );

  const prevOverrides = Object.fromEntries(
    target.permissionOverrides.map((o) => [o.permission, o.granted])
  );

  await prisma.$transaction(async (tx) => {
    // Delete all existing overrides for this user
    await tx.userPermissionOverride.deleteMany({ where: { userId: id } });

    // Insert new overrides (only those that differ from role default)
    const roleDefaults = new Set(ROLE_PERMISSIONS[target.role as UserRole] ?? []);
    const toInsert = Object.entries(sanitized).filter(
      ([perm, granted]) => granted !== roleDefaults.has(perm as never)
    );

    if (toInsert.length > 0) {
      await tx.userPermissionOverride.createMany({
        data: toInsert.map(([permission, granted]) => ({
          clientId: target.clientId,
          userId: id,
          permission,
          granted,
        })),
      });
    }
  });

  // Audit: log only when the EFFECTIVE permission changed
  const roleDefaultsForAudit = new Set<string>(ROLE_PERMISSIONS[target.role as UserRole] ?? []);
  const allPermsForAudit = new Set([...Object.keys(prevOverrides), ...Object.keys(sanitized)]);
  const auditEntries: Promise<void>[] = [];

  for (const perm of allPermsForAudit) {
    const oldEffective = perm in prevOverrides ? prevOverrides[perm] : roleDefaultsForAudit.has(perm);
    const newEffective = perm in sanitized ? sanitized[perm] : roleDefaultsForAudit.has(perm);
    if (oldEffective !== newEffective) {
      auditEntries.push(
        createAuditLog({
          user: session.user,
          entityType: "UserPermissionOverride",
          entityId: id,
          action: "UPDATE",
          fieldName: perm,
          oldValue: oldEffective ? "granted" : "denied",
          newValue: newEffective ? "granted" : "denied",
        })
      );
    }
  }

  await Promise.all(auditEntries);

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      permissionOverrides: { select: { permission: true, granted: true } },
    },
  });

  if (!target || target.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  await prisma.userPermissionOverride.deleteMany({ where: { userId: id } });

  if (target.permissionOverrides.length > 0) {
    await createAuditLog({
      user: session.user,
      entityType: "UserPermissionOverride",
      entityId: id,
      action: "RESET",
      fieldName: "permissions",
      oldValue: JSON.stringify(
        Object.fromEntries(target.permissionOverrides.map((o) => [o.permission, o.granted]))
      ),
      newValue: "role_default",
    });
  }

  return NextResponse.json({ success: true });
}
