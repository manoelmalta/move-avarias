/**
 * src/lib/protected-users.ts
 *
 * Defines system-level protected users that cannot be modified or deactivated
 * by any actor, including other ADMIN users. Protection is enforced server-side.
 */

/**
 * Email of the permanently protected system administrator.
 * This user cannot have their role changed, cannot be deactivated,
 * and cannot be deleted via any API endpoint.
 *
 * The user's own password change (via /account) remains allowed.
 */
export const PROTECTED_ADMIN_EMAIL = "manoel.malta@faus.com.br";

/**
 * Returns true if the given email belongs to a protected system administrator.
 * Comparison is case-insensitive.
 */
export function isProtectedAdmin(email: string): boolean {
  return email.trim().toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase();
}
