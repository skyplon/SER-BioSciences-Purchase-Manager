import { useRoute, useLocation, Link } from "wouter";
import {
  useGetInvoice,
  getGetInvoiceQueryKey,
  useDeleteInvoice,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORIES } from "@/lib/categories";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2, Calendar, Hash, Store, FileText, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function InvoiceDetail() {
  const [, params] = useRoute("/invoices/:id");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const id = params ? parseInt(params.id, 10) : 0;

  const { data: invoice, isLoading } = useGetInvoice(id, {
    query: { enabled: !!id, queryKey: getGetInvoiceQueryKey(id) },
  });

  const deleteMutation = useDeleteInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        toast({ title: "Factura eliminada" });
        setLocation("/invoices");
      },
      onError: () => {
        toast({ title: "Error al eliminar", variant: "destructive" });
      },
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-36" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Factura no encontrada</p>
        <Link href="/invoices">
          <Button className="mt-4" variant="outline" data-testid="button-back-not-found">Volver</Button>
        </Link>
      </div>
    );
  }

  const catColor = CATEGORIES[invoice.category]?.color ?? "#888";

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/invoices">
            <Button variant="ghost" size="icon" data-testid="button-back-detail">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{invoice.supplier}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="text-xs text-white border-0" style={{ backgroundColor: catColor }}>
                {invoice.category}
              </Badge>
              {invoice.invoiceNumber && (
                <span className="text-xs text-muted-foreground">#{invoice.invoiceNumber}</span>
              )}
            </div>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="icon" className="text-destructive hover:text-destructive" data-testid="button-delete-invoice-detail">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar factura</AlertDialogTitle>
              <AlertDialogDescription>
                Esta accion no se puede deshacer. La factura sera eliminada permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-detail">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground"
                onClick={() => deleteMutation.mutate({ id: invoice.id })}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete-detail"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Invoice info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de Compra</p>
                  <p className="text-sm font-medium" data-testid="text-invoice-date">{formatDate(invoice.date)}</p>
                </div>
              </div>
              {invoice.invoiceNumber && (
                <div className="flex items-start gap-3">
                  <Hash className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Numero de Factura</p>
                    <p className="text-sm font-medium" data-testid="text-invoice-number">{invoice.invoiceNumber}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Store className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Proveedor</p>
                  <p className="text-sm font-medium" data-testid="text-invoice-supplier">{invoice.supplier}</p>
                </div>
              </div>
              {invoice.buyer && (
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Comprador</p>
                    <p className="text-sm font-medium" data-testid="text-invoice-buyer">{invoice.buyer}</p>
                  </div>
                </div>
              )}
              {invoice.notes && (
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Notas</p>
                    <p className="text-sm" data-testid="text-invoice-notes">{invoice.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center justify-center">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Total de Compra (COP)</p>
              <p className="text-4xl font-bold text-foreground" data-testid="text-invoice-total">
                {formatCurrency(invoice.totalAmount)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Image */}
      {invoice.imageBase64 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Imagen de la Factura</CardTitle>
          </CardHeader>
          <CardContent>
            <img
              src={`data:image/jpeg;base64,${invoice.imageBase64}`}
              alt="Factura"
              className="w-full max-h-96 object-contain rounded border border-border"
              data-testid="img-invoice-original"
            />
          </CardContent>
        </Card>
      )}

      {/* Items */}
      {invoice.items && invoice.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Articulos / Servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-invoice-items">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-2 font-medium text-muted-foreground">Descripcion</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">Cant.</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground">Unidad</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">P. Unit.</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id} data-testid={`row-item-detail-${idx}`}>
                      <td className="py-2 pr-4">{item.description}</td>
                      <td className="py-2 text-right">{item.quantity ?? "—"}</td>
                      <td className="py-2 px-4 text-muted-foreground">{item.unit ?? "—"}</td>
                      <td className="py-2 text-right">{item.unitPrice != null ? formatCurrency(item.unitPrice) : "—"}</td>
                      <td className="py-2 text-right font-medium">{item.totalPrice != null ? formatCurrency(item.totalPrice) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                {invoice.totalAmount != null && (
                  <tfoot>
                    <tr className="border-t border-border">
                      <td colSpan={4} className="pt-3 text-right font-semibold">Total Factura:</td>
                      <td className="pt-3 text-right font-bold">{formatCurrency(invoice.totalAmount)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <p className="text-xs text-muted-foreground">
          Registrada el {formatDate(invoice.createdAt)}
        </p>
      </div>
    </div>
  );
}
