"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";

interface AppShellProps {
  children: React.ReactNode;
  /** Server-rendered header content (AuthUserMenu) passed as an opaque ReactNode */
  header: React.ReactNode;
}

/**
 * AppShell — client-only layout wrapper that manages the mobile sidebar open/close state.
 * On desktop (≥ md) the sidebar is always visible in the flex flow.
 * On mobile (< md) the sidebar is hidden and slides in as an overlay when the hamburger is pressed.
 */
export function AppShell({ children, header }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  // Public routes render without shell (no sidebar, no header)
  if (pathname.startsWith("/public")) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full">
      {/* ── Desktop sidebar: always visible at md+ ───────────────────── */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* ── Mobile sidebar overlay ────────────────────────────────────── */}
      {mobileOpen && (
        <>
          {/* Semi-transparent backdrop — click to close */}
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={closeMobile}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="fixed left-0 top-0 z-50 h-full md:hidden">
            <Sidebar onMobileClose={closeMobile} />
          </div>
        </>
      )}

      {/* ── Content area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b flex items-center justify-between px-4 md:px-6 bg-card shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Hamburger button — mobile only */}
            <button
              className="md:hidden flex items-center justify-center h-10 w-10 rounded-md hover:bg-accent transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu de navegação"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* System name — mobile only (logo is inside the sidebar) */}
            <span className="md:hidden text-sm font-semibold tracking-wide">
              MOVE AVARIAS
            </span>
          </div>

          <div className="flex items-center gap-4">
            {header}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3 md:p-6 bg-muted/40">
          {children}
        </main>
      </div>
    </div>
  );
}
