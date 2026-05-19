import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit";

/**
 * POST /api/account/change-password
 *
 * Permite que o usuário logado altere sua própria senha.
 * O userId vem da sessão — nunca do payload.
 * Nenhuma senha ou hash é retornada ou registrada em log.
 */
export async function POST(req: NextRequest) {
  // ── Autenticação ──────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // ── Payload ───────────────────────────────────────────────────────────────
  const body = await req.json() as unknown;

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { currentPassword, newPassword, confirmPassword } = body as Record<string, unknown>;

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  // ── Validações de formato ─────────────────────────────────────────────────
  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "A nova senha e a confirmação não coincidem" },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "A nova senha deve ter pelo menos 8 caracteres" },
      { status: 400 }
    );
  }

  // ── Buscar usuário pelo session.user.id (nunca pelo payload) ──────────────
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, clientId: true, active: true, passwordHash: true },
  });

  if (!user || !user.active) {
    return NextResponse.json(
      { error: "Usuário não encontrado ou inativo" },
      { status: 403 }
    );
  }

  if (!user.passwordHash) {
    return NextResponse.json(
      { error: "Conta sem senha configurada. Contate o administrador." },
      { status: 400 }
    );
  }

  // ── Validar senha atual ───────────────────────────────────────────────────
  const validCurrent = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!validCurrent) {
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
  }

  // ── Nova senha não pode ser igual à atual ─────────────────────────────────
  const sameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
  if (sameAsCurrent) {
    return NextResponse.json(
      { error: "A nova senha não pode ser igual à senha atual" },
      { status: 400 }
    );
  }

  // ── Gerar hash e atualizar apenas o usuário logado ────────────────────────
  const newHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  // ── Audit log sem expor hash ou senha ─────────────────────────────────────
  await createAuditLog({
    user: session.user,
    entityType: "User",
    entityId: user.id,
    action: "UPDATE",
    fieldName: "passwordHash",
    oldValue: "[REDACTED]",
    newValue: "[REDACTED]",
  });

  return NextResponse.json({ ok: true });
}
