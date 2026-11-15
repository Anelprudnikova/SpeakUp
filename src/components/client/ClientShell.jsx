import { useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { FileText, LayoutDashboard, LogOut, Menu, PlusCircle, User as UserIcon, X } from "lucide-react";
import Brand from "@/components/Brand";
import LangSwitch from "@/components/LangSwitch";
import NavUnreadBadge from "@/components/NavUnreadBadge";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/client", key: "nav.clientHome", icon: LayoutDashboard, exact: true },
  { to: "/client/new", key: "client.newRequest", icon: PlusCircle },
  { to: "/client/requests", key: "client.myHeading", icon: FileText },
  { to: "/client/notifications", key: "client.notifHeading", badge: true },
  { to: "/client/profile", key: "client.profileHeading", icon: UserIcon },
];

export default function ClientShell() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const displayName = user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "";

  const isActive = (item) =>
    item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active ? "bg-primary/10 text-primary" : "text-navy/75 hover:bg-muted hover:text-navy"
            )}
          >
            {item.badge ? (
              <NavUnreadBadge client />
            ) : (
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-navy/45")} />
            )}
            <span className="flex-1 truncate">{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link to="/client" className="block px-6 pb-2 pt-6" onClick={() => setOpen(false)}>
      <Brand size="md" withSlogan={false} />
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-border bg-card lg:flex">
        {brand}
        {nav}
        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy">{displayName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            aria-label={t("common.logout")}
            className="rounded-lg p-2 text-muted-foreground transition hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/client">
          <Brand size="sm" withSlogan={false} />
        </Link>
        <div className="flex items-center gap-2">
          <LangSwitch />
          <button type="button" onClick={() => setOpen(true)} aria-label={t("common.actions")} className="rounded-lg border border-border p-2 text-navy">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-[300px] flex-col bg-card shadow-2xl">
            <div className="flex items-center justify-between pr-4">
              {brand}
              <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="rounded-lg p-2 text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-2 border-t border-border px-5 py-4 text-sm font-medium text-muted-foreground"
            >
              <LogOut className="h-4 w-4" /> {t("common.logout")}
            </button>
          </div>
        </div>
      ) : null}

      <main className="lg:pl-[264px]">
        <div className="sticky top-0 z-20 hidden items-center justify-between border-b border-border bg-background/85 px-10 py-2.5 backdrop-blur lg:flex">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">{t("app.tagline")}</p>
          <LangSwitch />
        </div>
        <div className="mx-auto w-full max-w-[1040px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
