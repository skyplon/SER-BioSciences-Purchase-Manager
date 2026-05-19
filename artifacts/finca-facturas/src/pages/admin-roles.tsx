import { useMemo, useState } from "react";
import { useListUsers, useUpdateUserRole, getListUsersQueryKey, getGetMyRoleQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMyRole, type Role } from "@/lib/use-my-role";
import { useT, type TransKey } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield, ShieldCheck, ShieldOff, Pencil, Search, Loader2, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLE_META: Record<Role, { labelKey: TransKey; icon: typeof Shield; className: string }> = {
  admin: { labelKey: "roles.admin", icon: Crown, className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  editor: { labelKey: "roles.editor", icon: ShieldCheck, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  viewer: { labelKey: "roles.viewer", icon: ShieldOff, className: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300" },
};

export function RolesPage() {
  const t = useT();
  const { isAdmin, isLoading: roleLoading } = useMyRole();
  const { data: users, isLoading, error } = useListUsers({
    query: { enabled: isAdmin, queryKey: getListUsersQueryKey() },
  });
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateUserRole();

  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<{ id: string; name: string; email: string; from: Role; to: Role } | null>(null);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q),
    );
  }, [users, search]);

  if (roleLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <ShieldOff className="h-10 w-10 mx-auto mb-3 opacity-60" />
          {t("roles.adminOnly")}
        </CardContent>
      </Card>
    );
  }

  const confirmChange = async () => {
    if (!pending) return;
    try {
      await updateMutation.mutateAsync({ id: pending.id, data: { role: pending.to } });
      toast({ title: t("roles.updated"), description: `${pending.name || pending.email} → ${t(ROLE_META[pending.to].labelKey)}` });
      qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
      qc.invalidateQueries({ queryKey: getGetMyRoleQueryKey() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: t("roles.updateFailed"), description: msg, variant: "destructive" });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            {t("roles.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("roles.subtitle")}</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("roles.searchPlaceholder")}
            className="pl-9"
            data-testid="input-roles-search"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("roles.countLabel")}: {filtered.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : error ? (
            <div className="text-destructive p-6">{t("roles.loadError")}</div>
          ) : filtered.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center">{t("common.noResults")}</div>
          ) : (
            <div className="divide-y">
              {filtered.map((u) => {
                const meta = ROLE_META[(u.role as Role) ?? "viewer"];
                const RoleIcon = meta.icon;
                return (
                  <div
                    key={u.id}
                    className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-4"
                    data-testid={`row-user-${u.id}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {u.imageUrl ? (
                        <img src={u.imageUrl} alt="" className="h-10 w-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-medium">
                          {(u.name ?? u.email ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{u.name ?? t("roles.unnamed")}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email ?? u.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                      <Badge className={meta.className + " gap-1"}>
                        <RoleIcon className="h-3 w-3" />
                        {t(meta.labelKey)}
                      </Badge>
                      {u.isAdminBootstrap ? (
                        <span className="text-xs text-muted-foreground italic">{t("roles.bootstrap")}</span>
                      ) : (
                        <Select
                          value={u.role}
                          onValueChange={(v) => {
                            const to = v as Role;
                            if (to === u.role) return;
                            setPending({
                              id: u.id,
                              name: u.name ?? "",
                              email: u.email ?? u.id,
                              from: u.role as Role,
                              to,
                            });
                          }}
                        >
                          <SelectTrigger className="w-36 h-9" data-testid={`select-role-${u.id}`}>
                            <Pencil className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">{t("roles.viewer")}</SelectItem>
                            <SelectItem value="editor">{t("roles.editor")}</SelectItem>
                            <SelectItem value="admin">{t("roles.admin")}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("roles.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("roles.confirmDesc")
                .replace("{name}", pending?.name || pending?.email || "")
                .replace("{from}", pending ? t(ROLE_META[pending.from].labelKey) : "")
                .replace("{to}", pending ? t(ROLE_META[pending.to].labelKey) : "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateMutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmChange} disabled={updateMutation.isPending} data-testid="button-confirm-role">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("roles.confirmApply")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
