import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, PlusCircle, Menu, X, LogOut, User, Settings } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useClerk, useUser } from "@clerk/react";
import { useT } from "@/lib/i18n";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const t = useT();

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
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{user?.fullName ?? user?.primaryEmailAddress?.emailAddress}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.primaryEmailAddress?.emailAddress}</p>
        </div>
      </div>
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

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const t = useT();

  const navItems = [
    { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/invoices", label: t("nav.invoices"), icon: FileText },
    { href: "/invoices/new", label: t("nav.newInvoice"), icon: PlusCircle },
  ];

  const bottomNavItems = [
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
        <div className="px-6 py-5 border-b border-border">
          <h1 className="text-lg font-semibold text-foreground">Finca Facturas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t("layout.subtitle")}</p>
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
          <div>
            <h1 className="text-lg font-semibold text-foreground">Finca Facturas</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Gestor de Compras</p>
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
        {/* Mobile user info */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-3 mb-2">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.fullName ?? ""}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("nav.signOut")}
          </button>
        </div>
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
          <h1 className="text-base font-semibold text-foreground flex-1">Finca Facturas</h1>
          <button
            onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })}
            className="text-muted-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
