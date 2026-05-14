import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UsersManager } from "@/components/users/users-manager";

async function getUsers(clientId: string) {
  return prisma.user.findMany({
    where: { clientId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const users = await getUsers(session.user.clientId);

  return (
    <div className="space-y-4">
      <UsersManager users={users} currentUserId={session.user.id} />
    </div>
  );
}
