import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useListSuppliers } from "@workspace/api-client-react";
import type { SupplierStats } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORIES } from "@/lib/categories";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, ArrowUpDown, ExternalLink, Search } from "lucide-react";
import { useT } from "@/lib/i18n";

type SortKey = "total" | "count" | "name" | "lastDate";

function sortSuppliers(list: SupplierStats[], key: SortKey): SupplierStats[] {
  return [...list].sort((a: SupplierStats, b: SupplierStats) => {
    switch (key) {
      case "total":
        return (b.total ?? 0) - (a.total ?? 0);
      case "count":
        return b.count - a.count;
      case "name":
        return a.supplier.localeCompare(b.supplier, "es");
      case "lastDate":
        return (b.lastDate ?? "").localeCompare(a.lastDate ?? "");
    }
  });
}

export function SuppliersPage() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");

  const { data: suppliers = [], isLoading } = useListSuppliers();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? suppliers.filter((s: SupplierStats) => s.supplier.toLowerCase().includes(q))
      : suppliers;
    return sortSuppliers(base, sortKey);
  }, [suppliers, search, sortKey]);

  const grandTotal = useMemo(
    () => suppliers.reduce((acc: number, s: SupplierStats) => acc + (s.total ?? 0), 0),
    [suppliers]
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("suppliers.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("suppliers.subtitle")}</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("suppliers.search")}
            className="pl-9"
            data-testid="input-supplier-search"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-48" data-testid="select-supplier-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total">{t("suppliers.sortTotal")}</SelectItem>
              <SelectItem value="count">{t("suppliers.sortCount")}</SelectItem>
              <SelectItem value="name">{t("suppliers.sortName")}</SelectItem>
              <SelectItem value="lastDate">{t("suppliers.sortLastDate")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="py-20 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">{t("suppliers.empty")}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">{t("suppliers.emptySearch")}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-suppliers">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("suppliers.colSupplier")}</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground w-24">{t("suppliers.colInvoices")}</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground w-40">{t("suppliers.colTotal")}</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground w-28 hidden md:table-cell">{t("suppliers.colFirstDate")}</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground w-28 hidden md:table-cell">{t("suppliers.colLastDate")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">{t("suppliers.colCategories")}</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((supplier, idx) => (
                  <SupplierRow key={supplier.supplier} supplier={supplier} idx={idx} t={t} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer summary */}
          <div className="border-t border-border bg-muted/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{filtered.length}</span>
              {" "}{t("suppliers.totalSuppliers")}
              {filtered.length !== suppliers.length && (
                <span className="text-muted-foreground"> / {suppliers.length}</span>
              )}
            </span>
            <span className="text-muted-foreground">
              {t("suppliers.totalSpend")}:{" "}
              <span className="font-semibold text-foreground">{formatCurrency(grandTotal)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SupplierRow({
  supplier,
  idx,
  t,
}: {
  supplier: SupplierStats;
  idx: number;
  t: (key: string) => string;
}) {
  const [, setLocation] = useLocation();
  const href = `/invoices?supplier=${encodeURIComponent(supplier.supplier)}`;

  return (
    <tr
      className="hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => setLocation(href)}
      data-testid={`row-supplier-${idx}`}
    >
      {/* Supplier name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium text-foreground">{supplier.supplier}</span>
        </div>
      </td>

      {/* Invoice count */}
      <td className="px-4 py-3 text-center">
        <Badge variant="secondary" className="font-mono text-xs">
          {supplier.count}
        </Badge>
      </td>

      {/* Total */}
      <td className="px-4 py-3 text-right font-semibold tabular-nums">
        {formatCurrency(supplier.total)}
      </td>

      {/* First date */}
      <td className="px-4 py-3 text-center text-muted-foreground text-xs hidden md:table-cell">
        {formatDate(supplier.firstDate)}
      </td>

      {/* Last date */}
      <td className="px-4 py-3 text-center text-muted-foreground text-xs hidden md:table-cell">
        {formatDate(supplier.lastDate)}
      </td>

      {/* Categories */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="flex flex-wrap gap-1">
          {supplier.categories.filter(Boolean).map((cat: string) => {
            const color = CATEGORIES[cat]?.color ?? "#888";
            return (
              <span
                key={cat}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs text-white font-medium"
                style={{ backgroundColor: color }}
              >
                {cat}
              </span>
            );
          })}
        </div>
      </td>

      {/* Action */}
      <td className="px-3 py-3 text-right">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          asChild
          title={t("suppliers.viewInvoices")}
        >
          <a href={href} onClick={(e) => e.stopPropagation()}>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </td>
    </tr>
  );
}
