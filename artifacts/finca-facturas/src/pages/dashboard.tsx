import { useMemo } from "react";
import { useGetInvoiceSummary, getGetInvoiceSummaryQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatCurrency, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, FileText, TrendingUp, ShoppingBag, Layers } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/contexts/settings-context";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const BRAND_TEAL = "#4d8f9c";
const EMPTY_COLOR = "#e5e7eb";

function shortCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-foreground mb-0.5">{label}</p>
      <p className="text-primary font-bold">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload?: { color?: string } }[] }) {
  if (!active || !payload?.length) return null;
  const color = payload[0].payload?.color ?? "#4d8f9c";
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-sm whitespace-nowrap">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
        <p className="font-medium text-foreground">{payload[0].name}</p>
      </div>
      <p className="font-bold" style={{ color }}>{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export function Dashboard() {
  const t = useT();
  const { language } = useSettings();
  const locale = language === "es" ? "es-CO" : "en-US";

  const { data: summary, isLoading } = useGetInvoiceSummary({
    query: { queryKey: getGetInvoiceSummaryQueryKey() },
  });

  const totalInvoices = summary?.totalInvoices ?? 0;
  const totalAmount = summary?.totalAmount ?? 0;
  const byCategory = summary?.byCategory ?? [];
  const bySupplier = summary?.bySupplier ?? [];
  const byMonth = summary?.byMonth ?? [];
  const recentInvoices = summary?.recentInvoices ?? [];

  const avgInvoice = totalInvoices > 0 ? totalAmount / totalInvoices : 0;
  const activeCategories = byCategory.length;

  const monthChartData = useMemo(() =>
    byMonth.map((m) => ({
      label: new Date(m.month + "-15").toLocaleString(locale, { month: "short" }),
      total: m.total,
      count: m.count,
    })),
    [byMonth, locale]
  );

  const hasMonthlyData = byMonth.some((m) => m.total > 0);

  const donutData = useMemo(() =>
    byCategory.length > 0
      ? byCategory.map((c) => ({
          name: c.category,
          value: c.total,
          color: CATEGORIES[c.category]?.color ?? "#888888",
        }))
      : [{ name: "—", value: 1, color: EMPTY_COLOR }],
    [byCategory]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-56 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t("dashboard.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <Link href="/invoices/new">
          <Button data-testid="button-new-invoice-dashboard">
            <PlusCircle className="h-4 w-4 mr-2" />
            {t("dashboard.captureInvoice")}
          </Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("dashboard.totalInvoices"), value: String(totalInvoices), icon: FileText, iconBg: "bg-primary/10", iconColor: "text-primary", testId: "stat-total-invoices" },
          { label: t("dashboard.totalSpend"), value: shortCurrency(totalAmount), valueTitle: formatCurrency(totalAmount), suffix: "COP", icon: TrendingUp, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600", testId: "stat-total-amount" },
          { label: t("dashboard.avgInvoice"), value: shortCurrency(avgInvoice), valueTitle: formatCurrency(avgInvoice), suffix: "COP", icon: ShoppingBag, iconBg: "bg-amber-500/10", iconColor: "text-amber-600" },
          { label: t("dashboard.activeCategories"), value: String(activeCategories), icon: Layers, iconBg: "bg-violet-500/10", iconColor: "text-violet-600" },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} data-testid={stat.testId} className="rounded-xl">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 ${stat.iconBg} rounded-lg flex-shrink-0`}>
                    <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground leading-tight mb-1">
                      {stat.label}
                    </p>
                    <p
                      className="text-lg sm:text-xl font-bold text-foreground leading-tight whitespace-nowrap"
                      title={stat.valueTitle}
                    >
                      {stat.value}
                      {stat.suffix && (
                        <span className="ml-1 text-[10px] font-medium text-muted-foreground align-middle">
                          {stat.suffix}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Monthly Bar Chart */}
      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{t("dashboard.monthlySpend")}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.monthlySpendSubtitle")}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!hasMonthlyData ? (
            <div className="flex items-center justify-center h-44 text-sm text-muted-foreground">
              {t("dashboard.noData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={shortCurrency}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={54}
                />
                <RechartsTooltip content={<BarTooltip />} cursor={{ fill: "hsl(var(--muted))", radius: 4 }} />
                <Bar dataKey="total" fill={BRAND_TEAL} radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Donut + Top Suppliers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Donut chart */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.byCategory")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("dashboard.byCategorySubtitle")}</p>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <div className="flex items-center justify-center h-44 text-sm text-muted-foreground">
                {t("dashboard.noData")}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-shrink-0">
                  <PieChart width={140} height={140}>
                    <Pie
                      data={donutData}
                      cx={66}
                      cy={66}
                      innerRadius={44}
                      outerRadius={66}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<DonutTooltip />} />
                  </PieChart>
                  {totalAmount > 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-muted-foreground">{t("dashboard.totalSpend")}</span>
                      <span className="text-sm font-bold text-foreground leading-tight">{shortCurrency(totalAmount)}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2 w-full" data-testid="list-by-category">
                  {byCategory.map((cat) => {
                    const pct = totalAmount > 0 ? (cat.total / totalAmount) * 100 : 0;
                    const color = CATEGORIES[cat.category]?.color ?? "#888888";
                    return (
                      <div key={cat.category} data-testid={`row-category-${cat.category}`}>
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs font-medium text-foreground truncate">{cat.category}</span>
                          </div>
                          <span
                            className="text-xs font-semibold text-foreground flex-shrink-0 whitespace-nowrap"
                            title={formatCurrency(cat.total)}
                          >
                            {shortCurrency(cat.total)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Suppliers */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.bySupplier")}</CardTitle>
          </CardHeader>
          <CardContent>
            {bySupplier.length === 0 ? (
              <div className="flex items-center justify-center h-44 text-sm text-muted-foreground">
                {t("dashboard.noData")}
              </div>
            ) : (
              <div className="space-y-3" data-testid="list-by-supplier">
                {bySupplier.slice(0, 6).map((sup, idx) => {
                  const pct = totalAmount > 0 ? (sup.total / totalAmount) * 100 : 0;
                  return (
                    <div key={sup.supplier} data-testid={`row-supplier-${sup.supplier}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xs font-bold text-muted-foreground w-4 flex-shrink-0">
                            {idx + 1}
                          </span>
                          <Link href={`/invoices?search=${encodeURIComponent(sup.supplier)}`} className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer truncate block">
                              {sup.supplier}
                            </span>
                          </Link>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span
                            className="text-sm font-semibold text-foreground whitespace-nowrap"
                            title={formatCurrency(sup.total)}
                          >
                            {shortCurrency(sup.total)}
                          </span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {sup.count} {t("dashboard.invoiceCountUnit")}
                          </span>
                        </div>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden ml-6">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {bySupplier.length > 6 && (
                  <Link href="/suppliers">
                    <Button variant="ghost" size="sm" className="w-full text-xs mt-1">
                      {t("dashboard.viewAll")} ({bySupplier.length})
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card className="rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">{t("dashboard.recent")}</CardTitle>
          <Link href="/invoices">
            <Button variant="ghost" size="sm" data-testid="link-view-all-invoices">
              {t("dashboard.viewAll")}
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t("dashboard.noInvoices")}</p>
              <Link href="/invoices/new">
                <Button className="mt-3" size="sm" data-testid="button-first-invoice">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  {t("dashboard.firstInvoice")}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1" data-testid="list-recent-invoices">
              {recentInvoices.map((inv) => {
                const catColor = CATEGORIES[inv.category]?.color ?? "#888888";
                return (
                  <Link key={inv.id} href={`/invoices/${inv.id}`}>
                    <div
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer"
                      data-testid={`card-invoice-${inv.id}`}
                    >
                      <div
                        className="h-8 w-1 rounded-full flex-shrink-0"
                        style={{ backgroundColor: catColor }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{inv.supplier}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs text-muted-foreground">{formatDate(inv.date)}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <Badge
                            className="text-[10px] px-1.5 py-0 h-4 font-normal border-0 text-white"
                            style={{ backgroundColor: catColor + "cc" }}
                          >
                            {inv.category}
                          </Badge>
                        </div>
                      </div>
                      <div className="ml-2 text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(inv.totalAmount)}</p>
                        {inv.invoiceNumber && (
                          <p className="text-xs text-muted-foreground">#{inv.invoiceNumber}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
