import { useState } from "react";
import {
  useListInvoices,
  getListInvoicesQueryKey,
  useDeleteInvoice,
  useExportInvoices,
  getExportInvoicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORY_OPTIONS, CATEGORIES } from "@/lib/categories";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { PlusCircle, Download, Trash2, Eye, Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SortField = "date" | "supplier" | "invoiceNumber" | "category" | "totalAmount" | "createdAt";
type SortDir = "asc" | "desc";

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 inline opacity-40" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 ml-1 inline text-primary" />
    : <ChevronDown className="h-3.5 w-3.5 ml-1 inline text-primary" />;
}

export function InvoicesList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [category, setCategory] = useState<string>("");
  const [searchSupplier, setSearchSupplier] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField | null>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const params: Record<string, string> = {};
  if (category && category !== "all") params.category = category;
  if (searchSupplier) params.supplier = searchSupplier;
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
        toast({ title: "Factura eliminada" });
        setDeleteId(null);
      },
      onError: () => {
        toast({ title: "Error al eliminar", variant: "destructive" });
      },
    },
  });

  const exportQuery = useExportInvoices({
    query: { queryKey: getExportInvoicesQueryKey(), enabled: false },
  });

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    if (result.data) {
      const { fileBase64, filename } = result.data;
      const blob = new Blob([Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0))], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const clearFilters = () => {
    setCategory("");
    setSearchSupplier("");
    setStartDate("");
    setEndDate("");
  };

  const hasFilters = category || searchSupplier || startDate || endDate;

  const sortedInvoices = [...(invoices ?? [])].sort((a, b) => {
    if (!sortField) return 0;
    let valA: string | number | null = null;
    let valB: string | number | null = null;
    if (sortField === "date") {
      valA = a.date ?? "";
      valB = b.date ?? "";
    } else if (sortField === "supplier") {
      valA = a.supplier.toLowerCase();
      valB = b.supplier.toLowerCase();
    } else if (sortField === "invoiceNumber") {
      valA = a.invoiceNumber ?? "";
      valB = b.invoiceNumber ?? "";
    } else if (sortField === "category") {
      valA = a.category.toLowerCase();
      valB = b.category.toLowerCase();
    } else if (sortField === "totalAmount") {
      valA = a.totalAmount ?? 0;
      valB = b.totalAmount ?? 0;
    } else if (sortField === "createdAt") {
      valA = a.createdAt;
      valB = b.createdAt;
    }
    if (valA === null || valB === null) return 0;
    if (valA < valB) return sortDir === "asc" ? -1 : 1;
    if (valA > valB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Facturas</h2>
          <p className="text-sm text-muted-foreground">Historial de compras registradas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exportQuery.isFetching}
            data-testid="button-export-excel"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          <Link href="/invoices/new">
            <Button data-testid="button-new-invoice">
              <PlusCircle className="h-4 w-4 mr-2" />
              Nueva Factura
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar proveedor..."
            value={searchSupplier}
            onChange={(e) => setSearchSupplier(e.target.value)}
            className="pl-8"
            data-testid="input-search-supplier"
          />
        </div>
        <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40" data-testid="select-category-filter">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorias</SelectItem>
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
            Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-lg">
          <p className="text-muted-foreground text-sm">No hay facturas{hasFilters ? " con esos filtros" : " registradas aun"}</p>
          {!hasFilters && (
            <Link href="/invoices/new">
              <Button className="mt-4" size="sm" data-testid="button-first-invoice-list">
                <PlusCircle className="h-4 w-4 mr-2" />
                Capturar primera factura
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
                  {(["date", "createdAt", "supplier", "invoiceNumber", "category", "totalAmount"] as SortField[]).map((field, i) => {
                    const labels: Record<SortField, string> = {
                      date: "Fecha Compra",
                      createdAt: "Fecha Creación",
                      supplier: "Proveedor",
                      invoiceNumber: "No. Factura",
                      category: "Categoría",
                      totalAmount: "Total",
                    };
                    const isRight = field === "totalAmount";
                    return (
                      <th
                        key={field}
                        className={`px-4 py-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap ${isRight ? "text-right" : "text-left"}`}
                        onClick={() => handleSort(field)}
                        data-testid={`th-sort-${field}`}
                      >
                        {labels[field]}
                        <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
                      </th>
                    );
                  })}
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-invoice-${inv.id}`}>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{inv.supplier}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.invoiceNumber ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge
                        className="text-xs text-white border-0"
                        style={{ backgroundColor: CATEGORIES[inv.category]?.color ?? "#888" }}
                      >
                        {inv.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(inv.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/invoices/${inv.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-view-invoice-${inv.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(inv.id)}
                          data-testid={`button-delete-invoice-${inv.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar factura</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. La factura y sus items seran eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
