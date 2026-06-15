import type { UserRole, SessionUser } from "@/lib/auth/types";

export type Permission =
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

export const ALL_PERMISSIONS: Permission[] = [
  "occurrence:create",
  "occurrence:view_own",
  "occurrence:view_all",
  "occurrence:edit_description",
  "occurrence:edit_status",
  "occurrence:edit_destination",
  "occurrence:edit_operational",
  "occurrence:complete",
  "occurrence:edit_any_field",
  "occurrence:edit_items",
  "occurrence:delete",
  "product:manage",
  "price:manage",
  "parameter:manage",
  "dashboard:indicators",
  "user:manage",
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "occurrence:create": "Criar ocorrência",
  "occurrence:view_own": "Visualizar próprias ocorrências",
  "occurrence:view_all": "Visualizar todas as ocorrências",
  "occurrence:edit_description": "Editar descrição / observações",
  "occurrence:edit_status": "Editar status",
  "occurrence:edit_destination": "Editar destino",
  "occurrence:edit_operational": "Editar campos operacionais",
  "occurrence:complete": "Concluir ocorrência",
  "occurrence:edit_any_field": "Editar qualquer campo",
  "occurrence:edit_items": "Editar itens da ocorrência",
  "occurrence:delete": "Excluir ocorrência",
  "product:manage": "Gerenciar produtos",
  "price:manage": "Gerenciar preços",
  "parameter:manage": "Gerenciar parâmetros",
  "dashboard:indicators": "Acessar dashboard e apuração mensal",
  "user:manage": "Gerenciar usuários e acessos",
};

export const PERMISSION_MODULES: { label: string; permissions: Permission[] }[] = [
  {
    label: "Ocorrências",
    permissions: [
      "occurrence:create",
      "occurrence:view_own",
      "occurrence:view_all",
      "occurrence:edit_description",
      "occurrence:edit_status",
      "occurrence:edit_destination",
      "occurrence:edit_operational",
      "occurrence:complete",
      "occurrence:edit_any_field",
      "occurrence:edit_items",
      "occurrence:delete",
    ],
  },
  {
    label: "Dashboard e Apuração",
    permissions: ["dashboard:indicators"],
  },
  {
    label: "Produtos e Preços",
    permissions: ["product:manage", "price:manage"],
  },
  {
    label: "Parâmetros",
    permissions: ["parameter:manage"],
  },
  {
    label: "Usuários e Acessos",
    permissions: ["user:manage"],
  },
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
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

export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(user: SessionUser, permission: Permission): boolean {
  const override = user.permissionOverrides?.[permission];
  if (override === true) return true;
  if (override === false) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export function canEditOccurrence(
  user: SessionUser,
  openedByUserId: string
): boolean {
  if (hasPermission(user, "occurrence:view_all")) return true;
  if (hasPermission(user, "occurrence:view_own")) return user.id === openedByUserId;
  return false;
}

export function assertPermission(user: SessionUser, permission: Permission): void {
  if (!hasPermission(user, permission)) {
    throw new Error(
      `Usuário sem permissão para executar a ação: ${permission}`
    );
  }
}
