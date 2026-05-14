import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { CreateUserSchema } from "@/lib/validations/user";
import { createAuditLog } from "@/lib/audit";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user, "user:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { clientId: session.user.clientId },
    select: USER_SELECT,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user, "user:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as unknown;
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, role, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        clientId: session.user.clientId,
        name,
        email,
        role,
        passwordHash,
      },
      select: USER_SELECT,
    });

    await createAuditLog({
      user: session.user,
      entityType: "User",
      entityId: user.id,
      action: "CREATE",
      fieldName: "email",
      newValue: email,
    });

    return NextResponse.json(user, { status: 201 });
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
