"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, PackagePlus, Package, DollarSign, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/occurrences", label: "Ocorrências", icon: ClipboardList },
  { href: "/occurrences/new", label: "Nova Ocorrência", icon: PackagePlus },
  { href: "/products", label: "Produtos", icon: Package },
  { href: "/prices", label: "Preços", icon: DollarSign },
  { href: "/parameters", label: "Parâmetros", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="w-60 shrink-0 h-full flex flex-col relative overflow-hidden"
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
        {/* Logo */}
        <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/logo.png"
            alt="MOVE AVARIAS"
            className="h-10 w-auto object-contain"
          />
          <p className="text-xs mt-2 tracking-wide uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
            Controle de Ocorrências
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href ||
              (href !== "/dashboard" &&
                pathname.startsWith(href) &&
                href !== "/occurrences/new");
            return (
              <Link
                key={href}
                href={href}
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

        {/* Footer */}
        <div className="px-5 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            MOVE AVARIAS · v1.0
          </p>
        </div>
      </div>
    </aside>
  );
}
