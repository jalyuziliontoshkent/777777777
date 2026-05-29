"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navByRole } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useAuth } from "@/components/providers";
import type { UserRole } from "@/types/app";

const navIcons: Record<string, string> = {
  "/admin/dashboard": "◈",
  "/admin/orders": "📋",
  "/admin/inventory": "📦",
  "/admin/dealers": "🤝",
  "/admin/workers": "👷",
  "/admin/chat": "💬",
  "/dealer/dashboard": "◈",
  "/dealer/orders": "📋",
  "/dealer/new-order": "➕",
  "/dealer/chat": "💬",
  "/worker/tasks": "📋",
  "/worker/completed": "✅",
};

export function AppShell({
  role,
  title,
  subtitle,
  actions,
  children,
}: {
  role: UserRole;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const theme = useAppStore((s) => s.theme);
  const { user, logout } = useAuth();
  const navigation = navByRole[role];
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="shell">
      {/* Mobile header */}
      <div className="mobile-header">
        <span className="mobile-header-title">{title}</span>
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setOpen(true)}
          aria-label="Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Overlay */}
      <div className={cn("sidebar-overlay", open && "open")} onClick={() => setOpen(false)} />

      {/* Sidebar */}
      <aside className={cn("shell-sidebar", open && "open")}>
        <div className="brand-card">
          <div className="split-row">
            <span className="brand-kicker">Curtain CRM</span>
            <button
              type="button"
              className="mobile-menu-btn"
              style={{ display: "none" } as any}
              id="sidebar-close-btn"
              onClick={() => setOpen(false)}
              aria-label="Yopish"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
          <h2>{user?.name || "Panel"}</h2>
          <p>{user?.email}</p>
        </div>

        <nav className="shell-nav">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn("nav-link", pathname === item.href && "nav-link-active")}
            >
              <span style={{ fontSize: 16 }}>{navIcons[item.href] || "•"}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="ghost-button" onClick={toggleTheme}>
            {theme === "dark" ? (
              <><span>☀️</span> Yorug' rejim</>
            ) : (
              <><span>🌙</span> Qorong'i rejim</>
            )}
          </button>
          <button type="button" className="ghost-button" onClick={logout}>
            <span>🚪</span> Chiqish
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="shell-main">
        <header className="page-header">
          <div>
            <span className="page-kicker">{role.toUpperCase()}</span>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="page-actions">{actions}</div>
        </header>
        <main className="page-body animate-fade-up">{children}</main>
      </div>

      <style jsx>{`
        @media (max-width: 1100px) {
          #sidebar-close-btn { display: grid !important; }
        }
      `}</style>
    </div>
  );
}
