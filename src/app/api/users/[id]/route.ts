import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { UpdateUserSchema } from "@/lib/validations/user";
import { createAuditLog, auditFieldChanges } from "@/lib/audit";
import { isProtectedAdmin } from "@/lib/protected-users";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user, "user:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, clientId: true, name: true, email: true, role: true, active: true },
  });

  if (!target || target.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const body = await req.json() as unknown;
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, role, active, newPassword } = parsed.data;

  // Proteção ADMIN PROTEGIDO: bloqueia alteração de role, status ou exclusão
  if (isProtectedAdmin(target.email)) {
    const triesChangeRole   = role !== undefined && role !== "ADMIN";
    const triesDeactivate   = active === false;
    const triesChangeEmail  = email !== undefined && email.trim().toLowerCase() !== target.email.toLowerCase();

    if (triesChangeRole || triesDeactivate || triesChangeEmail) {
      return NextResponse.json(
        {
          error:
            "Este administrador é protegido e não pode ter perfil, status ou e-mail alterado.",
        },
        { status: 403 }
      );
    }
  }

  // Proteção A: admin não pode inativar a si mesmo
  if (target.id === session.user.id && active === false) {
    return NextResponse.json(
      { error: "Você não pode inativar sua própria conta" },
      { status: 403 }
    );
  }

  // Proteção B/C/D: verificar se ficaria sem ADMIN ativo
  const isTargetCurrentlyOnlyAdmin =
    target.role === "ADMIN" && target.active === true;

  if (isTargetCurrentlyOnlyAdmin) {
    const activeAdminCount = await prisma.user.count({
      where: { clientId: session.user.clientId, role: "ADMIN", active: true },
    });

    if (activeAdminCount <= 1) {
      const wouldLoseAdmin =
        (role !== undefined && role !== "ADMIN") ||
        (active === false);

      if (wouldLoseAdmin) {
        return NextResponse.json(
          { error: "O sistema precisa ter pelo menos um ADMIN ativo" },
          { status: 409 }
        );
      }
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (role !== undefined) updateData.role = role;
  if (active !== undefined) updateData.active = active;

  let passwordChanged = false;
  if (newPassword !== undefined) {
    updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    passwordChanged = true;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: target.id },
      data: updateData,
      select: USER_SELECT,
    });

    // Audit: campos escalares alterados
    const scalarChanges: Record<string, { old: unknown; new: unknown }> = {};
    if (name !== undefined && name !== target.name) {
      scalarChanges.name = { old: target.name, new: name };
    }
    if (email !== undefined && email !== target.email) {
      scalarChanges.email = { old: target.email, new: email };
    }
    if (role !== undefined && role !== target.role) {
      scalarChanges.role = { old: target.role, new: role };
    }
    if (active !== undefined && active !== target.active) {
      scalarChanges.active = { old: target.active, new: active };
    }

    if (Object.keys(scalarChanges).length > 0) {
      await auditFieldChanges(session.user, "User", target.id, scalarChanges);
    }

    // Audit: senha alterada sem expor hash
    if (passwordChanged) {
      await createAuditLog({
        user: session.user,
        entityType: "User",
        entityId: target.id,
        action: "UPDATE",
        fieldName: "passwordHash",
        oldValue: "[REDACTED]",
        newValue: "[REDACTED]",
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    if (isP2002(err)) {
      return NextResponse.json(
        { error: "Email já cadastrado para este cliente" },
        { status: 409 }
      );
    }
    throw err;
  }
}

function isP2002(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}
