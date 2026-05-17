import { useGetInvoiceSummary, getGetInvoiceSummaryQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatCurrency, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, FileText, TrendingUp, ShoppingBag } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { useT } from "@/lib/i18n";

export function Dashboard() {
  const t = useT();
  const { data: summary, isLoading } = useGetInvoiceSummary({
    query: { queryKey: getGetInvoiceSummaryQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const totalInvoices = summary?.totalInvoices ?? 0;
  const totalAmount = summary?.totalAmount ?? 0;
  const byCategory = summary?.byCategory ?? [];
  const bySupplier = summary?.bySupplier ?? [];
  const recentInvoices = summary?.recentInvoices ?? [];

  return (
    <div className="space-y-6">
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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card data-testid="stat-total-invoices">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("dashboard.totalInvoices")}</p>
                <p className="text-2xl font-bold text-foreground">{totalInvoices}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-total-amount">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("dashboard.totalSpend")}</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              {t("dashboard.byCategory")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("dashboard.noData")}</p>
            ) : (
              <div className="space-y-3" data-testid="list-by-category">
                {byCategory.map((cat) => (
                  <div key={cat.category} className="flex items-center justify-between" data-testid={`row-category-${cat.category}`}>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        style={{ backgroundColor: CATEGORIES[cat.category]?.color ?? "#888", color: "#fff" }}
                      >
                        {cat.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{cat.count} {t("dashboard.invoiceCountUnit")}</span>
                    </div>
                    <span className="text-sm font-medium">{formatCurrency(cat.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Suppliers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.bySupplier")}</CardTitle>
          </CardHeader>
          <CardContent>
            {bySupplier.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("dashboard.noData")}</p>
            ) : (
              <div className="space-y-3" data-testid="list-by-supplier">
                {bySupplier.slice(0, 5).map((sup) => (
                  <div key={sup.supplier} className="flex items-center justify-between" data-testid={`row-supplier-${sup.supplier}`}>
                    <div>
                      <p className="text-sm font-medium text-foreground">{sup.supplier}</p>
                      <p className="text-xs text-muted-foreground">{sup.count} {t("dashboard.invoiceCountUnit")}</p>
                    </div>
                    <span className="text-sm font-medium">{formatCurrency(sup.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("dashboard.recent")}</CardTitle>
          <Link href="/invoices">
            <Button variant="ghost" size="sm" data-testid="link-view-all-invoices">{t("dashboard.viewAll")}</Button>
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
            <div className="space-y-2" data-testid="list-recent-invoices">
              {recentInvoices.map((inv) => (
                <Link key={inv.id} href={`/invoices/${inv.id}`}>
                  <div
                    className="flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors cursor-pointer"
                    data-testid={`card-invoice-${inv.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{inv.supplier}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(inv.date)} · {inv.category}</p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(inv.totalAmount)}</p>
                      {inv.invoiceNumber && (
                        <p className="text-xs text-muted-foreground">#{inv.invoiceNumber}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
