export type UserRole = "SEPARADOR" | "LIDER" | "ANALISTA" | "GESTOR" | "ADMIN";

export interface SessionUser {
  id: string;
  clientId: string;
  name: string;
  email: string;
  role: UserRole;
  permissionOverrides: Record<string, boolean>;
}
