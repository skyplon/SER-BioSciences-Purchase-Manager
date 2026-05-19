import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FileText, PlusCircle, Menu, X, LogOut, User, Settings, Building2,
  CalendarDays, Activity, Shield, Crown, ShieldCheck, ShieldOff, ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useClerk, useUser } from "@clerk/react";
import { useT, type TransKey } from "@/lib/i18n";
import { NotificationBell } from "@/components/notification-bell";
import { useMyRole, useImpersonation, type Role } from "@/lib/use-my-role";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const ROLE_BADGE: Record<Role, { labelKey: TransKey; icon: typeof Shield; cls: string }> = {
  admin: { labelKey: "roles.admin", icon: Crown, cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-200" },
  editor: { labelKey: "roles.editor", icon: ShieldCheck, cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border-emerald-200" },
  viewer: { labelKey: "roles.viewer", icon: ShieldOff, cls: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border-slate-200" },
};

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const t = useT();
  const meta = ROLE_BADGE[role];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn(meta.cls, "gap-1 font-medium", className)} data-testid={`badge-role-${role}`}>
      <Icon className="h-3 w-3" />
      {t(meta.labelKey)}
    </Badge>
  );
}

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const t = useT();
  const { role, actualRole, isAdmin, isImpersonating } = useMyRole();
  const { setImpersonate } = useImpersonation();

  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="flex items-center gap-3 mb-2">
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={user.fullName ?? ""}
            className="h-8 w-8 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{user?.fullName ?? user?.primaryEmailAddress?.emailAddress}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.primaryEmailAddress?.emailAddress}</p>
        </div>
      </div>

      <div className="mb-2">
        <RoleBadge role={role} />
      </div>

      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="button-impersonate"
              className="flex items-center justify-between w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors mb-1"
            >
              <span className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5" />
                {t("impersonate.title")}
              </span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-48">
            <DropdownMenuLabel className="text-xs">{t("impersonate.actualRole")}: {t(ROLE_BADGE[actualRole].labelKey)}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(["viewer", "editor", "admin"] as Role[]).map((r) => (
              <DropdownMenuItem
                key={r}
                onClick={() => setImpersonate(r === actualRole ? null : r)}
                data-testid={`menu-impersonate-${r}`}
                className={cn(role === r && "bg-muted font-medium")}
              >
                <span className="flex items-center gap-2 w-full">
                  {(() => {
                    const Icon = ROLE_BADGE[r].icon;
                    return <Icon className="h-3.5 w-3.5" />;
                  })()}
                  {t(ROLE_BADGE[r].labelKey)}
                  {role === r && <span className="ml-auto text-xs opacity-70">●</span>}
                </span>
              </DropdownMenuItem>
            ))}
            {isImpersonating && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setImpersonate(null)} data-testid="menu-impersonate-stop">
                  <X className="h-3.5 w-3.5 mr-2" />
                  {t("impersonate.none")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <button
        onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
      >
        <LogOut className="h-3.5 w-3.5" />
        {t("nav.signOut")}
      </button>
    </div>
  );
}

function ImpersonationBanner() {
  const t = useT();
  const { role, isImpersonating } = useMyRole();
  const { setImpersonate } = useImpersonation();
  if (!isImpersonating) return null;
  return (
    <div
      role="status"
      data-testid="banner-impersonating"
      className="flex items-center justify-center gap-3 px-4 py-2 text-sm bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 border-b border-amber-200 dark:border-amber-900"
    >
      <Shield className="h-4 w-4 flex-shrink-0" />
      <span className="text-center">
        {t("impersonate.bannerPrefix")} <strong>{t(ROLE_BADGE[role].labelKey)}</strong> {t("impersonate.bannerSuffix")}
      </span>
      <button
        onClick={() => setImpersonate(null)}
        className="ml-2 px-2 py-0.5 text-xs rounded border border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
        data-testid="button-stop-impersonating"
      >
        {t("impersonate.stop")}
      </button>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const t = useT();
  const { isAdmin, isEditor, role } = useMyRole();

  const navItems = [
    { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/invoices", label: t("nav.invoices"), icon: FileText },
    { href: "/suppliers", label: t("nav.suppliers"), icon: Building2 },
    { href: "/calendar", label: t("nav.calendar"), icon: CalendarDays },
    ...(isEditor ? [{ href: "/invoices/new", label: t("nav.newInvoice"), icon: PlusCircle }] : []),
  ];

  const bottomNavItems = [
    ...(isAdmin ? [{ href: "/audit", label: t("nav.audit"), icon: Activity }] : []),
    ...(isAdmin ? [{ href: "/admin/roles", label: t("nav.roles"), icon: Shield }] : []),
    { href: "/settings", label: t("nav.settings"), icon: Settings },
  ];

  const renderNavLink = (item: { href: string; label: string; icon: React.ElementType }, onClose?: () => void) => {
    const Icon = item.icon;
    const isActive = location === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        data-testid={`nav-${item.href.replace(/\//g, "-").replace(/^-/, "") || "dashboard"}`}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-card">
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}logo-icon.png`}
            alt="SER BioSciences"
            className="h-10 w-10 object-contain flex-shrink-0"
          />
          <div>
            <h1 className="text-base font-semibold text-foreground leading-tight">SER BioSciences</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{t("layout.subtitle")}</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => renderNavLink(item))}
        </nav>
        <nav className="px-3 pb-2 space-y-1 border-t border-border pt-2">
          {bottomNavItems.map((item) => renderNavLink(item))}
        </nav>
        <UserMenu />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-card border-r border-border transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}logo-icon.png`}
              alt="SER BioSciences"
              className="h-9 w-9 object-contain flex-shrink-0"
            />
            <div>
              <h1 className="text-base font-semibold text-foreground leading-tight">SER BioSciences</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{t("layout.subtitle")}</p>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => renderNavLink(item, () => setMobileOpen(false)))}
        </nav>
        <nav className="px-3 pb-2 space-y-1 border-t border-border pt-2">
          {bottomNavItems.map((item) => renderNavLink(item, () => setMobileOpen(false)))}
        </nav>
        <UserMenu />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-4 px-4 py-3 border-b border-border bg-card">
          <button
            onClick={() => setMobileOpen(true)}
            data-testid="button-mobile-menu"
            className="text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img
            src={`${import.meta.env.BASE_URL}ser-biosciences-logo.png`}
            alt="SER BioSciences"
            className="h-7 w-auto object-contain"
          />
          <div className="ml-auto flex items-center gap-2">
            <RoleBadge role={role} className="hidden sm:inline-flex" />
            <NotificationBell />
            <button
              onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })}
              className="text-muted-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden md:flex items-center justify-end gap-3 px-6 py-2 border-b border-border bg-card">
          <img
            src={`${import.meta.env.BASE_URL}ser-biosciences-logo.png`}
            alt="SER BioSciences"
            className="h-10 w-auto object-contain mr-auto"
          />
          <RoleBadge role={role} />
          <NotificationBell />
        </header>

        <ImpersonationBanner />

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>

      {/* Hide unused user variable to keep useUser usage */}
      <span data-user-id={user?.id} className="hidden" />
    </div>
  );
}
