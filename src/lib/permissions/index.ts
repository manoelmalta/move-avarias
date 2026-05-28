import type { UserRole, SessionUser } from "@/lib/auth/types";

type Permission =
  | "occurrence:create"
  | "occurrence:view_own"
  | "occurrence:view_all"
  | "occurrence:edit_description"
  | "occurrence:edit_status"
  | "occurrence:edit_destination"
  | "occurrence:edit_operational"
  | "occurrence:complete"
  | "occurrence:edit_any_field"
  | "occurrence:edit_items"
  | "occurrence:delete"
  | "product:manage"
  | "price:manage"
  | "parameter:manage"
  | "dashboard:indicators"
  | "user:manage";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SEPARADOR: [
    "occurrence:create",
    "occurrence:view_own",
  ],
  LIDER: [
    "occurrence:create",
    "occurrence:view_all",
  ],
  ANALISTA: [
    "occurrence:create",
    "occurrence:view_all",
    "occurrence:edit_description",
    "occurrence:edit_status",
    "occurrence:edit_destination",
    "occurrence:complete",
    "occurrence:edit_items",
    "dashboard:indicators",
    "product:manage",
    "price:manage",
  ],
  GESTOR: [
    "occurrence:view_all",
    "dashboard:indicators",
  ],
  ADMIN: [
    "occurrence:create",
    "occurrence:view_all",
    "occurrence:edit_description",
    "occurrence:edit_operational",
    "occurrence:edit_status",
    "occurrence:edit_destination",
    "occurrence:complete",
    "occurrence:edit_any_field",
    "occurrence:edit_items",
    "occurrence:delete",
    "dashboard:indicators",
    "product:manage",
    "price:manage",
    "parameter:manage",
    "user:manage",
  ],
};

export function hasPermission(user: SessionUser, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export function canEditOccurrence(
  user: SessionUser,
  openedByUserId: string
): boolean {
  if (user.role === "SEPARADOR") return user.id === openedByUserId;
  return hasPermission(user, "occurrence:view_all");
}

export function assertPermission(user: SessionUser, permission: Permission): void {
  if (!hasPermission(user, permission)) {
    throw new Error(
      `Usuário sem permissão para executar a ação: ${permission}`
    );
  }
}
