import { useState } from "react";
import { useUser } from "@clerk/react";
import { useRoute, useLocation, Link } from "wouter";
import {
  useGetInvoice,
  getGetInvoiceQueryKey,
  useDeleteInvoice,
  useUpdateInvoice,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import type { CreateInvoiceItemBody } from "@workspace/api-client-react";
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
import { ArrowLeft, Trash2, Calendar, Hash, Store, FileText, User, AlignLeft, Download, Pencil, Check, X, Plus, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";

export function InvoiceDetail() {
  const t = useT();
  const { user } = useUser();
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
  const [editItems, setEditItems] = useState<CreateInvoiceItemBody[]>([]);

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
    setEditItems(
      (invoice.items ?? []).map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        unitPrice: item.unitPrice ?? null,
        totalPrice: item.totalPrice ?? null,
      }))
    );
    setIsEditing(true);
  };

  const handleSave = () => {
    const updatedBy = user?.fullName ?? user?.firstName ?? null;
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
        updatedBy,
        items: editItems,
      },
    });
  };

  const handleItemChange = (idx: number, field: keyof CreateInvoiceItemBody, value: string) => {
    setEditItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (field === "quantity" || field === "unitPrice" || field === "totalPrice") {
          return { ...item, [field]: value === "" ? null : parseFloat(value) };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handleAddItem = () => {
    setEditItems((prev) => [
      ...prev,
      { name: "", description: "", quantity: null, unit: null, unitPrice: null, totalPrice: null },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
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

  const today = new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
                size="sm"
                onClick={() => window.print()}
                className="no-print"
                data-testid="button-print-invoice"
              >
                <Printer className="h-4 w-4 mr-2" />
                {t("invoiceDetail.print")}
              </Button>
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
      <div>
        <Card>
          <CardContent className="pt-6">
            {/* Total banner */}
            <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border bg-muted/40 px-4 py-3">
              <p className="text-sm text-muted-foreground">{t("invoiceDetail.totalPurchase")}</p>
              {isEditing ? (
                <Input
                  type="number"
                  value={editTotal}
                  onChange={(e) => setEditTotal(e.target.value)}
                  className="max-w-[200px] text-2xl font-bold h-12 text-right"
                  data-testid="edit-total"
                />
              ) : (
                <p className="text-3xl sm:text-4xl font-bold text-foreground" data-testid="text-invoice-total">
                  {formatCurrency(invoice.totalAmount)}
                </p>
              )}
            </div>
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
                    <AlignLeft className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">{t("invoiceDetail.description")}</p>
                      <p className="text-sm break-words whitespace-pre-line" data-testid="text-invoice-description">{invoice.description}</p>
                    </div>
                  </div>
                )}
                {invoice.notes && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">{t("invoiceDetail.notes")}</p>
                      <p className="text-sm break-words whitespace-pre-line" data-testid="text-invoice-notes">{invoice.notes}</p>
                    </div>
                  </div>
                )}
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
      {(isEditing || (invoice.items && invoice.items.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("invoiceDetail.items")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left pb-2 font-medium text-muted-foreground">{t("invoiceDetail.itemNameHeader")}</th>
                        <th className="text-right pb-2 font-medium text-muted-foreground w-20">{t("invoiceDetail.itemQty")}</th>
                        <th className="text-left pb-2 font-medium text-muted-foreground w-24 px-2">{t("invoiceDetail.itemUnit")}</th>
                        <th className="text-right pb-2 font-medium text-muted-foreground w-28">{t("invoiceDetail.itemUnitPrice")}</th>
                        <th className="text-right pb-2 font-medium text-muted-foreground w-28">{t("invoiceDetail.itemTotal")}</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {editItems.map((item, idx) => (
                        <tr key={idx} data-testid={`row-item-edit-${idx}`}>
                          <td className="py-1 pr-2 align-top">
                            <div className="space-y-1">
                              <Input
                                value={item.name ?? ""}
                                onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                                placeholder={t("invoiceDetail.itemNameHeader")}
                                className="h-8 text-sm font-medium"
                                data-testid={`edit-item-name-${idx}`}
                              />
                              <Input
                                value={item.description}
                                onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                                placeholder={t("invoiceDetail.itemDescription")}
                                className="h-8 text-sm"
                                data-testid={`edit-item-description-${idx}`}
                              />
                            </div>
                          </td>
                          <td className="py-1 px-1">
                            <Input
                              type="number"
                              value={item.quantity ?? ""}
                              onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                              placeholder="—"
                              className="h-8 text-sm text-right w-20"
                              data-testid={`edit-item-qty-${idx}`}
                            />
                          </td>
                          <td className="py-1 px-1">
                            <Input
                              value={item.unit ?? ""}
                              onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                              placeholder="—"
                              className="h-8 text-sm w-24"
                              data-testid={`edit-item-unit-${idx}`}
                            />
                          </td>
                          <td className="py-1 px-1">
                            <Input
                              type="number"
                              value={item.unitPrice ?? ""}
                              onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                              placeholder="—"
                              className="h-8 text-sm text-right w-28"
                              data-testid={`edit-item-unit-price-${idx}`}
                            />
                          </td>
                          <td className="py-1 pl-1">
                            <Input
                              type="number"
                              value={item.totalPrice ?? ""}
                              onChange={(e) => handleItemChange(idx, "totalPrice", e.target.value)}
                              placeholder="—"
                              className="h-8 text-sm text-right w-28"
                              data-testid={`edit-item-total-${idx}`}
                            />
                          </td>
                          <td className="py-1 pl-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveItem(idx)}
                              title={t("invoiceDetail.removeItem")}
                              data-testid={`button-remove-item-${idx}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={handleAddItem}
                  data-testid="button-add-item"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("invoiceDetail.addItem")}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-invoice-items">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left pb-2 font-medium text-muted-foreground">{t("invoiceDetail.itemNameHeader")}</th>
                      <th className="text-right pb-2 font-medium text-muted-foreground">{t("invoiceDetail.itemQty")}</th>
                      <th className="text-left pb-2 font-medium text-muted-foreground">{t("invoiceDetail.itemUnit")}</th>
                      <th className="text-right pb-2 font-medium text-muted-foreground">{t("invoiceDetail.itemUnitPrice")}</th>
                      <th className="text-right pb-2 font-medium text-muted-foreground">{t("invoiceDetail.itemTotal")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoice.items.map((item, idx) => (
                      <tr key={item.id} data-testid={`row-item-detail-${idx}`}>
                        <td className="py-2 pr-4 align-top">
                          {item.name && (
                            <p className="font-medium" data-testid={`text-item-name-${idx}`}>{item.name}</p>
                          )}
                          {item.description && (
                            <p className={item.name ? "text-xs text-muted-foreground mt-0.5" : ""} data-testid={`text-item-description-${idx}`}>
                              {item.description}
                            </p>
                          )}
                        </td>
                        <td className="py-2 text-right align-top">{item.quantity ?? "—"}</td>
                        <td className="py-2 px-4 text-muted-foreground align-top">{item.unit ?? "—"}</td>
                        <td className="py-2 text-right align-top">{item.unitPrice != null ? formatCurrency(item.unitPrice) : "—"}</td>
                        <td className="py-2 text-right font-medium align-top">{item.totalPrice != null ? formatCurrency(item.totalPrice) : "—"}</td>
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
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end print-hide">
        <p className="text-xs text-muted-foreground">
          {t("invoiceDetail.registeredOn")} {formatDate(invoice.createdAt)}
        </p>
      </div>

      {/* ── PRINT LAYOUT (hidden on screen, visible when printing) ────────── */}
      <div className="print-only print-invoice hidden" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2pt solid #111", paddingBottom: "10pt", marginBottom: "16pt" }}>
          <div>
            <div style={{ fontSize: "18pt", fontWeight: "bold", letterSpacing: "-0.5pt" }}>SER BioSciences</div>
            <div style={{ fontSize: "9pt", color: "#555", marginTop: "2pt" }}>Finca Citrus & Ganadería · Colombia</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "14pt", fontWeight: "bold", color: "#333" }}>{t("invoiceDetail.printTitle")}</div>
            <div style={{ fontSize: "9pt", color: "#555", marginTop: "3pt" }}>{t("invoiceDetail.printGeneratedOn")}: {today}</div>
          </div>
        </div>

        {/* Metadata grid */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "14pt", fontSize: "10pt" }}>
          <tbody>
            <tr>
              <td style={{ width: "18%", fontWeight: "bold", padding: "4pt 6pt", border: "0.5pt solid #ccc", background: "#f4f4f4" }}>{t("invoiceDetail.supplier")}</td>
              <td style={{ width: "32%", padding: "4pt 6pt", border: "0.5pt solid #ccc" }}>{invoice.supplier}</td>
              <td style={{ width: "18%", fontWeight: "bold", padding: "4pt 6pt", border: "0.5pt solid #ccc", background: "#f4f4f4" }}>{t("invoiceDetail.purchaseDate")}</td>
              <td style={{ width: "32%", padding: "4pt 6pt", border: "0.5pt solid #ccc" }}>{formatDate(invoice.date)}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", padding: "4pt 6pt", border: "0.5pt solid #ccc", background: "#f4f4f4" }}>{t("invoiceDetail.invoiceNumber")}</td>
              <td style={{ padding: "4pt 6pt", border: "0.5pt solid #ccc" }}>{invoice.invoiceNumber ?? "—"}</td>
              <td style={{ fontWeight: "bold", padding: "4pt 6pt", border: "0.5pt solid #ccc", background: "#f4f4f4" }}>{t("invoiceDetail.category")}</td>
              <td style={{ padding: "4pt 6pt", border: "0.5pt solid #ccc" }}>{invoice.category}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", padding: "4pt 6pt", border: "0.5pt solid #ccc", background: "#f4f4f4" }}>{t("invoiceDetail.buyer")}</td>
              <td style={{ padding: "4pt 6pt", border: "0.5pt solid #ccc" }}>{invoice.buyer ?? "—"}</td>
              <td style={{ fontWeight: "bold", padding: "4pt 6pt", border: "0.5pt solid #ccc", background: "#f4f4f4" }}>{t("invoiceDetail.totalPurchase")}</td>
              <td style={{ padding: "4pt 6pt", border: "0.5pt solid #ccc", fontWeight: "bold", fontSize: "11pt" }}>{formatCurrency(invoice.totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        {/* Description */}
        {invoice.description && (
          <div style={{ marginBottom: "12pt" }}>
            <div style={{ fontWeight: "bold", fontSize: "10pt", marginBottom: "4pt", borderBottom: "0.5pt solid #ccc", paddingBottom: "3pt" }}>{t("invoiceDetail.description")}</div>
            <div style={{ fontSize: "10pt", color: "#333" }}>{invoice.description}</div>
          </div>
        )}

        {/* Items table */}
        {invoice.items && invoice.items.length > 0 && (
          <div className="items-section" style={{ marginBottom: "14pt" }}>
            <div style={{ fontWeight: "bold", fontSize: "10pt", marginBottom: "6pt", borderBottom: "0.5pt solid #ccc", paddingBottom: "3pt" }}>{t("invoiceDetail.items")}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt" }}>
              <thead>
                <tr>
                  <th style={{ padding: "5pt 6pt", border: "0.5pt solid #ccc", background: "#f4f4f4", textAlign: "left" }}>{t("invoiceDetail.itemDescription")}</th>
                  <th style={{ padding: "5pt 6pt", border: "0.5pt solid #ccc", background: "#f4f4f4", textAlign: "right", width: "10%" }}>{t("invoiceDetail.itemQty")}</th>
                  <th style={{ padding: "5pt 6pt", border: "0.5pt solid #ccc", background: "#f4f4f4", textAlign: "left", width: "12%" }}>{t("invoiceDetail.itemUnit")}</th>
                  <th style={{ padding: "5pt 6pt", border: "0.5pt solid #ccc", background: "#f4f4f4", textAlign: "right", width: "18%" }}>{t("invoiceDetail.itemUnitPrice")}</th>
                  <th style={{ padding: "5pt 6pt", border: "0.5pt solid #ccc", background: "#f4f4f4", textAlign: "right", width: "18%" }}>{t("invoiceDetail.itemTotal")}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "4pt 6pt", border: "0.5pt solid #ccc" }}>{item.description}</td>
                    <td style={{ padding: "4pt 6pt", border: "0.5pt solid #ccc", textAlign: "right" }}>{item.quantity ?? "—"}</td>
                    <td style={{ padding: "4pt 6pt", border: "0.5pt solid #ccc" }}>{item.unit ?? "—"}</td>
                    <td style={{ padding: "4pt 6pt", border: "0.5pt solid #ccc", textAlign: "right" }}>{item.unitPrice != null ? formatCurrency(item.unitPrice) : "—"}</td>
                    <td style={{ padding: "4pt 6pt", border: "0.5pt solid #ccc", textAlign: "right", fontWeight: "bold" }}>{item.totalPrice != null ? formatCurrency(item.totalPrice) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              {invoice.totalAmount != null && (
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ padding: "5pt 6pt", border: "0.5pt solid #ccc", textAlign: "right", fontWeight: "bold", background: "#f4f4f4" }}>{t("invoiceDetail.invoiceTotal")}</td>
                    <td style={{ padding: "5pt 6pt", border: "0.5pt solid #ccc", textAlign: "right", fontWeight: "bold", background: "#f4f4f4" }}>{formatCurrency(invoice.totalAmount)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div style={{ marginBottom: "14pt" }}>
            <div style={{ fontWeight: "bold", fontSize: "10pt", marginBottom: "4pt", borderBottom: "0.5pt solid #ccc", paddingBottom: "3pt" }}>{t("invoiceDetail.notes")}</div>
            <div style={{ fontSize: "10pt", color: "#333", whiteSpace: "pre-line" }}>{invoice.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "0.5pt solid #ccc", paddingTop: "8pt", marginTop: "10pt", fontSize: "8pt", color: "#888", display: "flex", justifyContent: "space-between" }}>
          <span>{t("invoiceDetail.printFooter")}</span>
          <span>{t("invoiceDetail.registeredOn")}: {formatDate(invoice.createdAt)}</span>
        </div>

        {/* Invoice image — new page */}
        {invoice.imageBase64 && (
          <div className="image-section" style={{ paddingTop: "12pt" }}>
            <div style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "10pt", borderBottom: "0.5pt solid #ccc", paddingBottom: "6pt" }}>{t("invoiceDetail.printOriginalInvoice")}</div>
            <img
              src={`data:image/jpeg;base64,${invoice.imageBase64}`}
              alt={t("invoiceDetail.invoiceImage")}
              style={{ maxWidth: "100%", maxHeight: "220mm", objectFit: "contain", display: "block", margin: "0 auto" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
