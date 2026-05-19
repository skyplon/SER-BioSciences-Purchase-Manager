import { useState } from "react";
import { useAuth } from "@clerk/react";
import {
  useListInvoices,
  getListInvoicesQueryKey,
  useDeleteInvoice,
} from "@workspace/api-client-react";
import { useSettings } from "@/contexts/settings-context";
import type { Invoice } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORY_OPTIONS, CATEGORIES } from "@/lib/categories";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusCircle, Download, Trash2, Eye, Search, X, ChevronUp, ChevronDown, ChevronsUpDown, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { useMyRole } from "@/lib/use-my-role";

type ColKey = "date" | "supplier" | "invoiceNumber" | "category" | "totalAmount" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy";
type SortField = "date" | "supplier" | "invoiceNumber" | "category" | "totalAmount" | "createdAt" | "updatedAt";
type SortDir = "asc" | "desc";

const ALL_COLUMNS: ColKey[] = [
  "date", "supplier", "invoiceNumber", "category", "totalAmount",
  "createdAt", "createdBy", "updatedAt", "updatedBy",
];

const COLS_STORAGE_KEY = "invoice-list-cols";

function loadVisibleCols(): ColKey[] {
  try {
    const stored = localStorage.getItem(COLS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ColKey[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return ALL_COLUMNS;
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 inline opacity-40" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 ml-1 inline text-primary" />
    : <ChevronDown className="h-3.5 w-3.5 ml-1 inline text-primary" />;
}

export function InvoicesList() {
  const t = useT();
  const { isEditor } = useMyRole();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const { language } = useSettings();
  const [isExporting, setIsExporting] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [search, setSearch] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("search") ?? params.get("supplier") ?? "";
  });
  const [startDate, setStartDate] = useState<string>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("startDate") ?? "";
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("endDate") ?? "";
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField | null>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(loadVisibleCols);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const COL_LABELS: Record<ColKey, string> = {
    date: t("invoices.colPurchaseDate"),
    supplier: t("invoices.colSupplier"),
    invoiceNumber: t("invoices.colNumber"),
    category: t("invoices.colCategory"),
    totalAmount: t("invoices.colTotal"),
    createdAt: t("invoices.colCreatedAt"),
    updatedAt: t("invoices.colUpdatedAt"),
    createdBy: t("invoices.colCreatedBy"),
    updatedBy: t("invoices.colUpdatedBy"),
  };

  const SORTABLE: Set<ColKey> = new Set(["date", "supplier", "invoiceNumber", "category", "totalAmount", "createdAt", "updatedAt"]);

  const toggleCol = (col: ColKey) => {
    setVisibleCols((prev) => {
      const next = prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col];
      try { localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleSort = (field: ColKey) => {
    if (!SORTABLE.has(field)) return;
    const sf = field as SortField;
    if (sortField === sf) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(sf);
      setSortDir("asc");
    }
  };

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (category && category !== "all") params.category = category;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const { data: invoices, isLoading } = useListInvoices(
    Object.keys(params).length > 0 ? params : undefined,
    { query: { queryKey: getListInvoicesQueryKey(Object.keys(params).length > 0 ? params : undefined) } }
  );

  const deleteMutation = useDeleteInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        toast({ title: t("invoices.deleteSuccess") });
        setDeleteId(null);
      },
      onError: () => {
        toast({ title: t("invoices.errorDeleting"), variant: "destructive" });
      },
    },
  });

  const sortedInvoices = [...(invoices ?? [])].sort((a, b) => {
    if (!sortField) return 0;
    let valA: string | number | null = null;
    let valB: string | number | null = null;
    if (sortField === "date") { valA = a.date ?? ""; valB = b.date ?? ""; }
    else if (sortField === "supplier") { valA = a.supplier.toLowerCase(); valB = b.supplier.toLowerCase(); }
    else if (sortField === "invoiceNumber") { valA = a.invoiceNumber ?? ""; valB = b.invoiceNumber ?? ""; }
    else if (sortField === "category") { valA = a.category.toLowerCase(); valB = b.category.toLowerCase(); }
    else if (sortField === "totalAmount") { valA = a.totalAmount ?? 0; valB = b.totalAmount ?? 0; }
    else if (sortField === "createdAt") { valA = a.createdAt; valB = b.createdAt; }
    else if (sortField === "updatedAt") { valA = a.updatedAt ?? null; valB = b.updatedAt ?? null; }
    if (valA === null || valB === null) return 0;
    if (valA < valB) return sortDir === "asc" ? -1 : 1;
    if (valA > valB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const allSelected = sortedInvoices.length > 0 && sortedInvoices.every((inv) => selectedIds.has(inv.id));
  const someSelected = selectedIds.size > 0;
  const indeterminate = someSelected && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedInvoices.map((inv) => inv.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const doExport = async (ids?: number[]) => {
    setIsExporting(true);
    try {
      const token = await getToken();
      const idsParam = ids && ids.length > 0 ? `&ids=${ids.join(",")}` : "";
      const res = await fetch(`/api/invoices/export?lang=${language}${idsParam}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const { fileBase64, filename } = await res.json();
      const blob = new Blob([Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0))], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t("invoices.exportError"), variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => doExport();
  const handleExportSelected = () => doExport(Array.from(selectedIds));

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/invoices/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Bulk delete failed");
      const { deleted } = await res.json() as { deleted: number };
      queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
      toast({ title: `${deleted} ${t("invoices.bulkDeleteSuccess")}` });
    } catch {
      toast({ title: t("invoices.bulkDeleteError"), variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setStartDate("");
    setEndDate("");
  };

  const hasFilters = search || category || startDate || endDate;

  const renderCell = (inv: Invoice, col: ColKey) => {
    switch (col) {
      case "date":
        return <td key={col} className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(inv.date)}</td>;
      case "supplier":
        return <td key={col} className="px-4 py-3 font-medium text-foreground">{inv.supplier}</td>;
      case "invoiceNumber":
        return <td key={col} className="px-4 py-3 text-muted-foreground">{inv.invoiceNumber ?? "—"}</td>;
      case "category":
        return (
          <td key={col} className="px-4 py-3">
            <Badge
              className="text-xs text-white border-0"
              style={{ backgroundColor: CATEGORIES[inv.category]?.color ?? "#888" }}
            >
              {inv.category}
            </Badge>
          </td>
        );
      case "totalAmount":
        return <td key={col} className="px-4 py-3 text-right font-medium">{formatCurrency(inv.totalAmount)}</td>;
      case "createdAt":
        return <td key={col} className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(inv.createdAt)}</td>;
      case "updatedAt":
        return <td key={col} className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(inv.updatedAt)}</td>;
      case "createdBy":
        return <td key={col} className="px-4 py-3 text-muted-foreground">{inv.createdBy ?? "—"}</td>;
      case "updatedBy":
        return <td key={col} className="px-4 py-3 text-muted-foreground">{inv.updatedBy ?? "—"}</td>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t("invoices.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("invoices.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title={t("invoices.configureColumns")} data-testid="button-configure-columns">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{t("invoices.columns")}</p>
              <div className="space-y-2">
                {ALL_COLUMNS.map((col) => (
                  <label key={col} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={visibleCols.includes(col)}
                      onCheckedChange={() => toggleCol(col)}
                      id={`col-toggle-${col}`}
                    />
                    <span className="text-sm">{COL_LABELS[col]}</span>
                  </label>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            data-testid="button-export-excel"
          >
            <Download className="h-4 w-4 mr-2" />
            {t("invoices.exportExcel")}
          </Button>
          {isEditor && (
            <Link href="/invoices/new">
              <Button data-testid="button-new-invoice">
                <PlusCircle className="h-4 w-4 mr-2" />
                {t("invoices.newInvoice")}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("invoices.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            data-testid="input-search-global"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44" data-testid="select-category-filter">
            <SelectValue placeholder={t("invoices.allCategories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("invoices.allCategories")}</SelectItem>
            {CATEGORY_OPTIONS.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-36"
          data-testid="input-start-date"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-36"
          data-testid="input-end-date"
        />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
            <X className="h-4 w-4 mr-1" />
            {t("invoices.clearFilters")}
          </Button>
        )}
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg border border-primary/30 bg-primary/5">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} {t("invoices.bulkSelected")}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSelected}
              disabled={isExporting}
              data-testid="button-export-selected"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t("invoices.bulkExportSelected")}
            </Button>
            {isEditor && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
                data-testid="button-delete-selected"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t("invoices.bulkDeleteSelected")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              data-testid="button-clear-selection"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              {t("invoices.bulkClearSelection")}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-lg">
          <p className="text-muted-foreground text-sm">
            {hasFilters ? t("invoices.noInvoicesFiltered") : t("invoices.noInvoices")}
          </p>
          {!hasFilters && isEditor && (
            <Link href="/invoices/new">
              <Button className="mt-4" size="sm" data-testid="button-first-invoice-list">
                <PlusCircle className="h-4 w-4 mr-2" />
                {t("invoices.firstInvoice")}
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden" data-testid="table-invoices">
          <div className="overflow-x-auto">

            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <Checkbox
                      checked={allSelected}
                      data-state={indeterminate ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  {ALL_COLUMNS.filter((col) => visibleCols.includes(col)).map((col) => {
                    const isSortable = SORTABLE.has(col);
                    const sf = col as SortField;
                    const isRight = col === "totalAmount";
                    return (
                      <th
                        key={col}
                        className={`px-4 py-3 font-medium text-muted-foreground select-none whitespace-nowrap transition-colors ${isRight ? "text-right" : "text-left"} ${isSortable ? "cursor-pointer hover:text-foreground" : ""}`}
                        onClick={isSortable ? () => handleSort(col) : undefined}
                        data-testid={isSortable ? `th-sort-${col}` : undefined}
                      >
                        {COL_LABELS[col]}
                        {isSortable && <SortIcon field={sf} sortField={sortField} sortDir={sortDir} />}
                      </th>
                    );
                  })}
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">{t("invoices.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`hover:bg-muted/30 transition-colors ${selectedIds.has(inv.id) ? "bg-primary/5" : ""}`}
                    data-testid={`row-invoice-${inv.id}`}
                  >
                    <td className="px-4 py-3 w-10">
                      <Checkbox
                        checked={selectedIds.has(inv.id)}
                        onCheckedChange={() => toggleSelect(inv.id)}
                        aria-label={`Select invoice ${inv.id}`}
                        data-testid={`checkbox-invoice-${inv.id}`}
                      />
                    </td>
                    {ALL_COLUMNS.filter((col) => visibleCols.includes(col)).map((col) => renderCell(inv, col))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/invoices/${inv.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-view-invoice-${inv.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {isEditor && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(inv.id)}
                            data-testid={`button-delete-invoice-${inv.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer: count + total */}
          {(() => {
            const filteredTotal = sortedInvoices.reduce((sum, inv) => sum + (inv.totalAmount ?? 0), 0);
            const count = sortedInvoices.length;
            const selectedTotal = someSelected
              ? sortedInvoices.filter((inv) => selectedIds.has(inv.id)).reduce((sum, inv) => sum + (inv.totalAmount ?? 0), 0)
              : null;
            return (
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 border-t bg-muted/30 text-sm" data-testid="table-footer-totals">
                <span className="text-muted-foreground">
                  {count} {hasFilters ? t("invoices.footerFiltered") : t("invoices.footerTotal")}
                </span>
                <div className="flex items-center gap-6">
                  {selectedTotal !== null && (
                    <span className="text-muted-foreground">
                      {t("invoices.footerSelectedLabel")}{" "}
                      <span className="font-semibold text-foreground">{formatCurrency(selectedTotal)}</span>
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {hasFilters ? t("invoices.footerFilteredTotal") : t("invoices.footerGrandTotal")}{" "}
                    <span className="font-bold text-foreground">{formatCurrency(filteredTotal)}</span>
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Single delete dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("invoices.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("invoices.deleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {t("invoices.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={(open) => !open && setShowBulkDeleteDialog(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("invoices.bulkDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("invoices.bulkDeleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              data-testid="button-confirm-bulk-delete"
            >
              {t("invoices.bulkDeleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
