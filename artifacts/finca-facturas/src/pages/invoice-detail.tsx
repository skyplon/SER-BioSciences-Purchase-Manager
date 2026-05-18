import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import {
  useGetInvoice,
  getGetInvoiceQueryKey,
  useDeleteInvoice,
  useUpdateInvoice,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORIES } from "@/lib/categories";
import { BUYER_OPTIONS } from "@/lib/buyers";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2, Calendar, Hash, Store, FileText, User, AlignLeft, Download, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";

export function InvoiceDetail() {
  const t = useT();
  const [, params] = useRoute("/invoices/:id");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const id = params ? parseInt(params.id, 10) : 0;

  const [isEditing, setIsEditing] = useState(false);
  const [editSupplier, setEditSupplier] = useState("");
  const [editInvoiceNumber, setEditInvoiceNumber] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editBuyer, setEditBuyer] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const { data: invoice, isLoading } = useGetInvoice(id, {
    query: { enabled: !!id, queryKey: getGetInvoiceQueryKey(id) },
  });

  const deleteMutation = useDeleteInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        toast({ title: t("invoices.deleteSuccess") });
        setLocation("/invoices");
      },
      onError: () => {
        toast({ title: t("invoiceDetail.errorDeleting"), variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInvoiceQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        toast({ title: t("invoiceDetail.saveSuccess") });
        setIsEditing(false);
      },
      onError: () => {
        toast({ title: t("invoiceDetail.errorSaving"), variant: "destructive" });
      },
    },
  });

  const handleEditStart = () => {
    if (!invoice) return;
    setEditSupplier(invoice.supplier ?? "");
    setEditInvoiceNumber(invoice.invoiceNumber ?? "");
    setEditDate(invoice.date ?? "");
    setEditCategory(invoice.category ?? "");
    setEditBuyer(invoice.buyer ?? "");
    setEditTotal(invoice.totalAmount != null ? String(invoice.totalAmount) : "");
    setEditDescription(invoice.description ?? "");
    setEditNotes(invoice.notes ?? "");
    setIsEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      id,
      data: {
        supplier: editSupplier,
        invoiceNumber: editInvoiceNumber || null,
        date: editDate || null,
        category: editCategory,
        buyer: editBuyer || null,
        totalAmount: editTotal ? parseFloat(editTotal) : null,
        description: editDescription || null,
        notes: editNotes || null,
      },
    });
  };

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
        <p className="text-muted-foreground">{t("invoiceDetail.notFound")}</p>
        <Link href="/invoices">
          <Button className="mt-4" variant="outline" data-testid="button-back-not-found">{t("invoiceDetail.back")}</Button>
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
            <h2 className="text-2xl font-bold text-foreground">
              {isEditing ? editSupplier || invoice.supplier : invoice.supplier}
            </h2>
            {!isEditing && (
              <div className="flex items-center gap-2 mt-1">
                <Badge className="text-xs text-white border-0" style={{ backgroundColor: catColor }}>
                  {invoice.category}
                </Badge>
                {invoice.invoiceNumber && (
                  <span className="text-xs text-muted-foreground">#{invoice.invoiceNumber}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                data-testid="button-save-invoice"
              >
                <Check className="h-4 w-4 mr-1" />
                {t("invoiceDetail.save")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={updateMutation.isPending}
                data-testid="button-cancel-edit"
              >
                <X className="h-4 w-4 mr-1" />
                {t("invoiceDetail.cancel")}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={handleEditStart}
                data-testid="button-edit-invoice"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="text-destructive hover:text-destructive" data-testid="button-delete-invoice-detail">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("invoiceDetail.deleteTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("invoiceDetail.deleteDesc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete-detail">{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground"
                      onClick={() => deleteMutation.mutate({ id: invoice.id })}
                      disabled={deleteMutation.isPending}
                      data-testid="button-confirm-delete-detail"
                    >
                      {t("invoiceDetail.delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Invoice info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>{t("invoiceDetail.supplier")}</Label>
                  <Input value={editSupplier} onChange={(e) => setEditSupplier(e.target.value)} data-testid="edit-supplier" />
                </div>
                <div className="space-y-1">
                  <Label>{t("invoiceDetail.invoiceNumber")}</Label>
                  <Input value={editInvoiceNumber} onChange={(e) => setEditInvoiceNumber(e.target.value)} data-testid="edit-invoice-number" />
                </div>
                <div className="space-y-1">
                  <Label>{t("invoiceDetail.purchaseDate")}</Label>
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} data-testid="edit-date" />
                </div>
                <div className="space-y-1">
                  <Label>{t("invoiceDetail.category")}</Label>
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger data-testid="edit-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(CATEGORIES).map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t("invoiceDetail.buyer")}</Label>
                  <Select value={editBuyer} onValueChange={setEditBuyer}>
                    <SelectTrigger data-testid="edit-buyer">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUYER_OPTIONS.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t("invoiceDetail.description")}</Label>
                  <Textarea rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} data-testid="edit-description" />
                </div>
                <div className="space-y-1">
                  <Label>{t("invoiceDetail.notes")}</Label>
                  <Textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} data-testid="edit-notes" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t("invoiceDetail.purchaseDate")}</p>
                    <p className="text-sm font-medium" data-testid="text-invoice-date">{formatDate(invoice.date)}</p>
                  </div>
                </div>
                {invoice.invoiceNumber && (
                  <div className="flex items-start gap-3">
                    <Hash className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t("invoiceDetail.invoiceNumber")}</p>
                      <p className="text-sm font-medium" data-testid="text-invoice-number">{invoice.invoiceNumber}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Store className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t("invoiceDetail.supplier")}</p>
                    <p className="text-sm font-medium" data-testid="text-invoice-supplier">{invoice.supplier}</p>
                  </div>
                </div>
                {invoice.buyer && (
                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t("invoiceDetail.buyer")}</p>
                      <p className="text-sm font-medium" data-testid="text-invoice-buyer">{invoice.buyer}</p>
                    </div>
                  </div>
                )}
                {invoice.description && (
                  <div className="flex items-start gap-3">
                    <AlignLeft className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t("invoiceDetail.description")}</p>
                      <p className="text-sm" data-testid="text-invoice-description">{invoice.description}</p>
                    </div>
                  </div>
                )}
                {invoice.notes && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t("invoiceDetail.notes")}</p>
                      <p className="text-sm whitespace-pre-line" data-testid="text-invoice-notes">{invoice.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center justify-center">
            {isEditing ? (
              <div className="w-full space-y-1">
                <Label className="text-xs text-muted-foreground">{t("invoiceDetail.totalPurchase")}</Label>
                <Input
                  type="number"
                  value={editTotal}
                  onChange={(e) => setEditTotal(e.target.value)}
                  className="text-2xl font-bold h-14 text-center"
                  data-testid="edit-total"
                />
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">{t("invoiceDetail.totalPurchase")}</p>
                <p className="text-4xl font-bold text-foreground" data-testid="text-invoice-total">
                  {formatCurrency(invoice.totalAmount)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Image */}
      {invoice.imageBase64 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("invoiceDetail.invoiceImage")}</CardTitle>
            <a
              href={`data:image/jpeg;base64,${invoice.imageBase64}`}
              download={`factura-${invoice.id}-${invoice.supplier.replace(/\s+/g, "_")}.jpg`}
              data-testid="button-download-image"
            >
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                {t("invoiceDetail.download")}
              </Button>
            </a>
          </CardHeader>
          <CardContent>
            <img
              src={`data:image/jpeg;base64,${invoice.imageBase64}`}
              alt={t("invoiceDetail.invoiceImage")}
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
            <CardTitle className="text-base">{t("invoiceDetail.items")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-invoice-items">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-2 font-medium text-muted-foreground">{t("invoiceDetail.itemDescription")}</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">{t("invoiceDetail.itemQty")}</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground">{t("invoiceDetail.itemUnit")}</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">{t("invoiceDetail.itemUnitPrice")}</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">{t("invoiceDetail.itemTotal")}</th>
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
                      <td colSpan={4} className="pt-3 text-right font-semibold">{t("invoiceDetail.invoiceTotal")}</td>
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
          {t("invoiceDetail.registeredOn")} {formatDate(invoice.createdAt)}
        </p>
      </div>
    </div>
  );
}
