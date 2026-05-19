import { useMemo, useState } from "react";
import { useListAuditLogs, useGetAuditLogStats, exportAuditLogs } from "@workspace/api-client-react";
import { useT } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Activity, Filter, Download, Plus, Pencil, Trash2, FileDown, RefreshCw,
  Sparkles, X, User as UserIcon, Calendar as CalendarIcon, Loader2,
} from "lucide-react";
import { useSettings } from "@/contexts/settings-context";

type AuditLog = {
  id: number;
  action: string;
  entityType: string;
  entityId?: number | null;
  entityLabel?: string | null;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  changes?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

function actionIcon(action: string) {
  switch (action) {
    case "created": return Plus;
    case "updated": return Pencil;
    case "deleted": return Trash2;
    case "exported": return FileDown;
    case "notion_synced":
    case "notion_sync_failed": return RefreshCw;
    case "ocr_extracted":
    case "ocr_failed": return Sparkles;
    default: return Activity;
  }
}

function actionColor(action: string): string {
  switch (action) {
    case "created": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "updated": return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "deleted": return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
    case "exported": return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "notion_synced": return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";
    case "notion_sync_failed":
    case "ocr_failed": return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    case "ocr_extracted": return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function formatDateTime(iso: string, locale: string) {
  const d = new Date(iso);
  return d.toLocaleString(locale === "es" ? "es-CO" : "en-US", {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function ChangesDisplay({ log, t }: { log: AuditLog; t: (k: any) => string }) {
  if (!log.changes) return null;
  const changes = log.changes;

  if (log.action === "updated") {
    const entries = Object.entries(changes) as [string, { before: unknown; after: unknown }][];
    if (entries.length === 0) return null;
    return (
      <div className="mt-2 space-y-1">
        {entries.map(([field, change]) => (
          <div key={field} className="text-xs flex items-baseline gap-2 flex-wrap">
            <span className="font-medium text-foreground">{field}:</span>
            <span className="text-rose-600 dark:text-rose-400 line-through truncate max-w-[200px]">
              {String(change?.before ?? "—")}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="text-emerald-600 dark:text-emerald-400 truncate max-w-[200px]">
              {String(change?.after ?? "—")}
            </span>
          </div>
        ))}
      </div>
    );
  }

  const entries = Object.entries(changes);
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <span className="text-muted-foreground">{k}:</span>
          <span className="text-foreground truncate">{v == null ? "—" : String(v)}</span>
        </div>
      ))}
    </div>
  );
}

export function AuditPage() {
  const t = useT();
  const { language } = useSettings();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("all");
  const [entityType, setEntityType] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const params = useMemo(() => {
    const p: Record<string, string | number> = { limit: 500 };
    if (search) p.search = search;
    if (action !== "all") p.action = action;
    if (entityType !== "all") p.entityType = entityType;
    if (userId !== "all") p.userId = userId;
    if (startDate) p.startDate = startDate;
    if (endDate) p.endDate = endDate;
    return p;
  }, [search, action, entityType, userId, startDate, endDate]);

  const { data: logs, isLoading, refetch } = useListAuditLogs(params);
  const { data: stats } = useGetAuditLogStats();
  const [exporting, setExporting] = useState(false);

  const hasFilters = search || action !== "all" || entityType !== "all" || userId !== "all" || startDate || endDate;

  const clearFilters = () => {
    setSearch(""); setAction("all"); setEntityType("all"); setUserId("all");
    setStartDate(""); setEndDate("");
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await exportAuditLogs();
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.fileBase64}`;
      link.download = res.filename;
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            {t("audit.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t("audit.subtitle")}</p>
        </div>
        <Button onClick={handleExport} disabled={exporting} variant="outline" size="sm">
          {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          {t("audit.exportExcel")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("audit.statTotal")} value={stats?.totalEvents ?? 0} />
        <StatCard label={t("audit.stat24h")} value={stats?.last24h ?? 0} hint={t("audit.lastDay")} />
        <StatCard label={t("audit.stat7d")} value={stats?.last7d ?? 0} hint={t("audit.lastWeek")} />
        <StatCard label={t("audit.stat30d")} value={stats?.last30d ?? 0} hint={t("audit.lastMonth")} />
      </div>

      {/* By Action / By User cards */}
      {stats && (stats.byAction.length > 0 || stats.byUser.length > 0) && (
        <div className="grid md:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("audit.byAction")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {stats.byAction.map((a) => {
                const Icon = actionIcon(a.action);
                return (
                  <button
                    key={a.action}
                    onClick={() => setAction(a.action)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${actionColor(a.action)}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <span className="text-sm text-foreground truncate">
                        {t(`audit.action.${a.action}` as any) || a.action}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{a.count}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("audit.byUser")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {stats.byUser.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">{t("audit.noUsers")}</p>
              )}
              {stats.byUser.map((u) => (
                <button
                  key={u.userId}
                  onClick={() => setUserId(u.userId)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="h-3 w-3 text-primary" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{u.userName ?? u.userEmail ?? u.userId}</p>
                      {u.userName && u.userEmail && (
                        <p className="text-[10px] text-muted-foreground truncate">{u.userEmail}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{u.count}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {t("audit.filters")}
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-7 text-xs">
                <X className="h-3 w-3 mr-1" /> {t("audit.clearFilters")}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              placeholder={t("audit.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:col-span-3"
            />
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue placeholder={t("audit.action")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("audit.allActions")}</SelectItem>
                <SelectItem value="created">{t("audit.action.created")}</SelectItem>
                <SelectItem value="updated">{t("audit.action.updated")}</SelectItem>
                <SelectItem value="deleted">{t("audit.action.deleted")}</SelectItem>
                <SelectItem value="exported">{t("audit.action.exported")}</SelectItem>
                <SelectItem value="notion_synced">{t("audit.action.notion_synced")}</SelectItem>
                <SelectItem value="ocr_extracted">{t("audit.action.ocr_extracted")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger><SelectValue placeholder={t("audit.entityType")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("audit.allTypes")}</SelectItem>
                <SelectItem value="invoice">{t("audit.entity.invoice")}</SelectItem>
                <SelectItem value="invoice_item">{t("audit.entity.invoice_item")}</SelectItem>
                <SelectItem value="system">{t("audit.entity.system")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue placeholder={t("audit.user")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("audit.allUsers")}</SelectItem>
                {stats?.byUser.map((u) => (
                  <SelectItem key={u.userId} value={u.userId}>
                    {u.userName ?? u.userEmail ?? u.userId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">
            {t("audit.timeline")}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({logs?.length ?? 0})
            </span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7">
            <RefreshCw className="h-3 w-3 mr-1" /> {t("audit.refresh")}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="p-8 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t("audit.empty")}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {(logs as AuditLog[]).map((log) => {
                const Icon = actionIcon(log.action);
                return (
                  <div key={log.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${actionColor(log.action)}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {t(`audit.action.${log.action}` as any) || log.action}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {t(`audit.entity.${log.entityType}` as any) || log.entityType}
                          </Badge>
                          {log.entityLabel && (
                            <span className="text-sm font-medium text-foreground truncate">{log.entityLabel}</span>
                          )}
                          {log.entityId != null && (
                            <span className="text-xs text-muted-foreground">#{log.entityId}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1">
                            <UserIcon className="h-3 w-3" />
                            {log.userName ?? log.userEmail ?? log.userId}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {formatDateTime(log.createdAt, language)}
                          </span>
                        </div>
                        <ChangesDisplay log={log} t={t} />
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="mt-1.5 text-[10px] text-muted-foreground">
                            {Object.entries(log.metadata).map(([k, v]) => (
                              <span key={k} className="inline-block mr-3">
                                <span className="font-medium">{k}:</span> {String(v)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
