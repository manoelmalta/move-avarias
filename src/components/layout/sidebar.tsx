"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Kanban,
  PackagePlus,
  Package,
  ScanSearch,
  DollarSign,
  Settings,
  Users,
  X,
  FileBarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth/session-context";
import { hasPermission } from "@/lib/permissions";

interface SidebarProps {
  /**
   * Provided when the sidebar is rendered as a mobile overlay drawer.
   * Calling this function closes the drawer. When undefined the sidebar is
   * in desktop mode and no close button is shown.
   */
  onMobileClose?: () => void;
}

export function Sidebar({ onMobileClose }: SidebarProps = {}) {
  const pathname = usePathname();
  const { user } = useSession();

  const navItems = user
    ? [
        ...(hasPermission(user, "dashboard:indicators")
          ? [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }]
          : []),
        ...(hasPermission(user, "dashboard:indicators")
          ? [{ href: "/closing-report", label: "Rel. Fechamento", icon: FileBarChart2 }]
          : []),
        ...(hasPermission(user, "occurrence:view_all") || hasPermission(user, "occurrence:view_own")
          ? [{ href: "/occurrences", label: "Ocorrências", icon: ClipboardList }]
          : []),
        ...(hasPermission(user, "occurrence:view_all") || hasPermission(user, "occurrence:view_own")
          ? [{ href: "/occurrences/pipeline", label: "Pipeline", icon: Kanban }]
          : []),
        ...(hasPermission(user, "occurrence:create")
          ? [{ href: "/occurrences/new", label: "Nova Ocorrência", icon: PackagePlus }]
          : []),
        ...(hasPermission(user, "occurrence:view_all") || hasPermission(user, "occurrence:view_own")
          ? [{ href: "/products/lookup", label: "Consulta de Produto", icon: ScanSearch }]
          : []),
        ...(hasPermission(user, "product:manage")
          ? [{ href: "/products", label: "Produtos", icon: Package }]
          : []),
        ...(hasPermission(user, "price:manage")
          ? [{ href: "/prices", label: "Preços", icon: DollarSign }]
          : []),
        ...(hasPermission(user, "parameter:manage")
          ? [{ href: "/parameters", label: "Parâmetros", icon: Settings }]
          : []),
        ...(user.role === "ADMIN"
          ? [{ href: "/users", label: "Usuários", icon: Users }]
          : []),
      ]
    : [];

  return (
    <aside
      className="w-64 shrink-0 h-full flex flex-col relative overflow-hidden"
      style={{ backgroundColor: "#1C2333" }}
    >
      {/* Background texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "url('/branding/background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          opacity: 0.07,
        }}
      />

      <div className="relative z-10 flex flex-col h-full">
        {/* ── Logo + optional mobile close button ─────────────────────── */}
        <div
          className="px-5 py-4 border-b flex items-start justify-between"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/branding/logo.png"
              alt="MOVE AVARIAS"
              className="h-10 w-auto object-contain"
            />
            <p
              className="text-xs mt-2 tracking-wide uppercase"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Controle de Ocorrências
            </p>
          </div>

          {/* Close button — only rendered in mobile overlay mode */}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="flex items-center justify-center h-10 w-10 rounded-md transition-colors shrink-0"
              style={{ color: "rgba(255,255,255,0.6)" }}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            // Exact-match-only routes: no sub-path activation
            const exactMatchOnly = new Set([
              "/dashboard",
              "/closing-report",
              "/occurrences/new",
              "/occurrences/pipeline",
              "/products",
              "/products/lookup",
            ]);
            const isActive =
              pathname === href ||
              (!exactMatchOnly.has(href) && pathname.startsWith(href + "/"));
            return (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150",
                  isActive ? "text-white" : ""
                )}
                style={
                  isActive
                    ? { backgroundColor: "#16A34A", color: "#ffffff" }
                    : { color: "rgba(255,255,255,0.60)" }
                }
                onMouseEnter={
                  isActive
                    ? undefined
                    : (e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.backgroundColor = "rgba(255,255,255,0.07)";
                        el.style.color = "rgba(255,255,255,0.92)";
                      }
                }
                onMouseLeave={
                  isActive
                    ? undefined
                    : (e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.backgroundColor = "transparent";
                        el.style.color = "rgba(255,255,255,0.60)";
                      }
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div
          className="px-5 py-3 border-t"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            MOVE AVARIAS · v1.0
          </p>
        </div>
      </div>
    </aside>
  );
}
