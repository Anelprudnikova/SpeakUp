import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  Send,
  Clock,
  BarChart3,
  User as UserIcon,
  Users,
  Building2,
  Tags,
  GitBranch,
  ScrollText,
  Settings,
  Repeat,
  Inbox,
  Menu,
  X,
  LogOut,
  ClipboardCheck,
} from "lucide-react";
import Brand from "@/components/Brand";
import LangSwitch from "@/components/LangSwitch";
import NavUnreadBadge from "@/components/NavUnreadBadge";
import { useI18n } from "@/lib/i18n";
import { getStaffRole } from "@/lib/roles";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

function buildNav(role) {
  const groups = [];
  const work = [
    { to: "/", key: "nav.home", icon: LayoutDashboard, exact: true },
    { to: "/requests/new", key: "nav.newRequest", icon: PlusCircle },
    { to: "/requests", key: "nav.myRequests", icon: FileText },
    // The administrator's inbox is the whole register of the company, not a personal queue.
    { to: "/assigned", key: role === "admin" ? "nav.allRequests" : "nav.assigned", icon: Inbox },
  ];

  // The client manager works both directions: the client queue and own requests.
  if (role === "client_manager") {
    return [
      {
        label: "nav.clientSection",
        items: [
          { to: "/", key: "nav.clientHome", icon: LayoutDashboard, exact: true },
          { to: "/client-requests", key: "nav.clientRequests", icon: Inbox },
          { to: "/client-handoff", key: "nav.clientHandoff", icon: Send },
        ],
      },
      {
        label: "nav.internalSection",
        items: [
          ...work.filter((item) => item.to !== "/"),
          { to: "/notifications", key: "nav.notifications", badge: true },
          { to: "/profile", key: "nav.profile", icon: UserIcon },
        ],
      },
    ];
  }

  // An employee works the client requests appointed to him in their own tab.
  if (role === "employee") work.push({ to: "/client-requests", key: "nav.clientRequests", icon: Inbox });
  work.push({ to: "/notifications", key: "nav.notifications", badge: true });
  work.push({ to: "/profile", key: "nav.profile", icon: UserIcon });
  groups.push({ label: "nav.sectionWork", items: work });

  if (role === "head" || role === "admin") {
    const manage = [
      { to: "/review", key: "nav.review", icon: ClipboardCheck },
      { to: "/distribution", key: "nav.distribution", icon: GitBranch },
      { to: "/overdue", key: "nav.overdue", icon: Clock },
      { to: "/analytics", key: "nav.analytics", icon: BarChart3 },
    ];
    if (role === "head") manage.push({ to: "/client-requests", key: "nav.clientRequests", icon: Inbox });
    if (role === "admin") {
      manage.push({ to: "/client-requests", key: "nav.clientRequests", icon: Inbox });
      manage.push({ to: "/client-handoff", key: "nav.clientHandoff", icon: Send });
      manage.push({ to: "/recurring", key: "nav.recurring", icon: Repeat });
    }
    groups.push({ label: "nav.sectionManage", items: manage });
  }

  if (role === "admin") {
    groups.push({
      label: "nav.sectionAdmin",
      items: [
        { to: "/admin/users", key: "nav.users", icon: Users },
        { to: "/admin/departments", key: "nav.departments", icon: Building2 },
        { to: "/admin/categories", key: "nav.categories", icon: Tags },
        { to: "/admin/audit", key: "nav.audit", icon: ScrollText },
        { to: "/admin/settings", key: "nav.settings", icon: Settings },
      ],
    });
  }
  return groups;
}

export default function Layout() {
  const { t } = useI18n();
  const { user, logout, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // A client account never sees the internal interface.
  useEffect(() => {
    if (!isLoadingAuth && user && user.account_type === "client") navigate({ to: "/client", replace: true });
  }, [isLoadingAuth, user, navigate]);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const role = getStaffRole(user);
  const groups = buildNav(role);
  const displayName = user?.full_name || user?.email || "";

  const isActive = (item) =>
    item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);

  const nav = (
    <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
            {t(group.label)}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-primary/10 text-primary shadow-[inset_2px_0_0_0_hsl(var(--primary))]"
                      : "text-navy/75 hover:bg-muted hover:text-navy"
                  )}
                >
                  {item.badge ? (
                    <NavUnreadBadge />
                  ) : (
                    <Icon className={cn("h-4.5 w-4.5 shrink-0", active ? "text-primary" : "text-navy/45 group-hover:text-navy/70")} />
                  )}
                  <span className="truncate">{t(item.key)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <Link to="/" className="block px-6 pb-2 pt-6" onClick={() => setOpen(false)}>
      <Brand size="md" />
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col border-r border-border bg-card lg:flex">
        {brand}
        {nav}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 rounded-xl bg-muted/70 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#20AFA4]/15 text-sm font-semibold text-[#158078]">
              {(displayName || "S").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-navy">{displayName || t("common.you")}</p>
              <p className="truncate text-[11px] text-muted-foreground">{t(`role.${role}`)}</p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              aria-label={t("common.logout")}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-card hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/">
          <Brand size="sm" withSlogan={false} />
        </Link>
        <div className="flex items-center gap-2">
          <LangSwitch />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("nav.home")}
            className="rounded-lg border border-border p-2 text-navy"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-[300px] flex-col bg-card shadow-2xl">
            <div className="flex items-center justify-between pr-4">
              {brand}
              <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="rounded-lg p-2 text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            <div className="border-t border-border p-4">
              <button
                type="button"
                onClick={() => logout()}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                <LogOut className="h-4 w-4" /> {t("common.logout")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main className="lg:pl-[272px]">
        <div className="sticky top-0 z-20 hidden border-b border-border bg-background/85 backdrop-blur lg:flex lg:items-center lg:justify-between lg:gap-4 lg:px-10 lg:py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
            {t("app.tagline")}
          </p>
          <div className="flex items-center gap-3">
            <LangSwitch />
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
