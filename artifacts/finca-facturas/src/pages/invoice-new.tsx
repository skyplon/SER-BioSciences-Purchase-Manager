import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useExtractInvoiceData, useValidateInvoiceData, useCreateInvoice, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Camera, Upload, Plus, Trash2, ArrowLeft, Loader2, CheckCircle, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CATEGORY_OPTIONS } from "@/lib/categories";
import { BUYER_OPTIONS } from "@/lib/buyers";
import { Link } from "wouter";

interface ItemRow {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  totalPrice: string;
}

const emptyItem = (): ItemRow => ({
  name: "",
  description: "",
  quantity: "",
  unit: "",
  unitPrice: "",
  totalPrice: "",
});

export function InvoiceNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [supplier, setSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Otros");
  const [buyer, setBuyer] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [validating, setValidating] = useState(false);

  const extractMutation = useExtractInvoiceData();
  const validateMutation = useValidateInvoiceData();
  const createMutation = useCreateInvoice({
    mutation: {
      onSuccess: (invoice) => {
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        toast({ title: "Factura guardada correctamente" });
        setLocation(`/invoices/${invoice.id}`);
      },
      onError: () => {
        toast({ title: "Error al guardar la factura", variant: "destructive" });
      },
    },
  });

  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      setImageBase64(base64);
      handleExtract(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleExtract = async (base64: string) => {
    setExtracting(true);
    setExtracted(false);
    try {
      const data = await extractMutation.mutateAsync({ data: { imageBase64: base64 } });
      if (data.supplier) setSupplier(data.supplier);
      if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber);
      if (data.date) setDate(data.date);
      if (data.category) setCategory(data.category);
      if (data.totalAmount != null) setTotalAmount(String(data.totalAmount));
      if (data.description) setDescription(data.description);
      if (data.notes) setNotes(data.notes);
      if (data.items && data.items.length > 0) {
        setItems(
          data.items.map((item) => ({
            name: item.name ?? "",
            description: item.description ?? "",
            quantity: item.quantity != null ? String(item.quantity) : "",
            unit: item.unit ?? "",
            unitPrice: item.unitPrice != null ? String(item.unitPrice) : "",
            totalPrice: item.totalPrice != null ? String(item.totalPrice) : "",
          }))
        );
      }
      setExtracted(true);
      toast({ title: "Datos extraidos correctamente. Revisa y corrige si es necesario." });
    } catch {
      toast({ title: "Error al extraer datos de la imagen", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const data = await validateMutation.mutateAsync({
        data: {
          invoiceNumber: invoiceNumber || null,
          supplier: supplier || null,
          date: date || null,
          category: category || null,
          totalAmount: totalAmount ? parseFloat(totalAmount) : null,
          description: description || null,
          notes: notes || null,
          buyer: buyer || null,
          items: items
            .filter((i) => i.name.trim() || i.description.trim())
            .map((i) => ({
              name: i.name.trim() || i.description.trim(),
              description: i.description.trim() || i.name.trim(),
              quantity: i.quantity ? parseFloat(i.quantity) : null,
              unit: i.unit.trim() || null,
              unitPrice: i.unitPrice ? parseFloat(i.unitPrice) : null,
              totalPrice: i.totalPrice ? parseFloat(i.totalPrice) : null,
            })),
        },
      });
      if (data.supplier) setSupplier(data.supplier);
      if (data.invoiceNumber !== undefined) setInvoiceNumber(data.invoiceNumber ?? "");
      if (data.category) setCategory(data.category);
      if (data.description) setDescription(data.description);
      if (data.notes) setNotes(data.notes ?? "");
      if (data.items && data.items.length > 0) {
        setItems(
          data.items.map((item) => ({
            name: item.name ?? "",
            description: item.description ?? "",
            quantity: item.quantity != null ? String(item.quantity) : "",
            unit: item.unit ?? "",
            unitPrice: item.unitPrice != null ? String(item.unitPrice) : "",
            totalPrice: item.totalPrice != null ? String(item.totalPrice) : "",
          }))
        );
      }
      toast({ title: "Validación completada. Campos corregidos y estandarizados." });
    } catch {
      toast({ title: "Error al validar los datos", variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  const addItem = () => setItems([...items, emptyItem()]);

  const updateItem = (idx: number, field: keyof ItemRow, value: string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const isItemValid = (item: ItemRow) =>
    item.name.trim() && item.description.trim() && item.quantity && item.unit.trim() && item.unitPrice && item.totalPrice;

  const handleSave = () => {
    setShowErrors(true);

    const headerInvalid =
      !supplier.trim() ||
      !invoiceNumber.trim() ||
      !date ||
      !buyer ||
      !totalAmount ||
      !description.trim() ||
      !notes.trim();

    const validItems = items.filter((i) => i.name.trim() || i.description.trim());
    const itemsInvalid = validItems.length === 0 || validItems.some((i) => !isItemValid(i));

    if (headerInvalid || itemsInvalid) {
      toast({
        title: "Campos incompletos",
        description: "Completa todos los campos obligatorios antes de guardar.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      data: {
        supplier: supplier.trim(),
        invoiceNumber: invoiceNumber.trim(),
        date,
        category,
        totalAmount: parseFloat(totalAmount),
        imageBase64: imageBase64 || null,
        description: description.trim(),
        notes: notes.trim(),
        buyer,
        items: validItems.map((item) => ({
          name: item.name.trim(),
          description: item.description.trim(),
          quantity: parseFloat(item.quantity),
          unit: item.unit.trim(),
          unitPrice: parseFloat(item.unitPrice),
          totalPrice: parseFloat(item.totalPrice),
        })),
      },
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/invoices">
          <Button variant="ghost" size="icon" data-testid="button-back-to-list">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Nueva Factura</h2>
          <p className="text-sm text-muted-foreground">Captura o carga una foto de la factura</p>
        </div>
      </div>

      {/* Image capture */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Imagen de la Factura</CardTitle>
        </CardHeader>
        <CardContent>
          {imagePreview ? (
            <div className="space-y-3">
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Vista previa de la factura"
                  className="w-full max-h-64 object-contain rounded border border-border"
                  data-testid="img-invoice-preview"
                />
                {extracting && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded">
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Extrayendo datos...</p>
                    </div>
                  </div>
                )}
              </div>
              {extracted && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Datos extraidos automaticamente. Revisa y corrige si es necesario.
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImageBase64(null);
                  setImagePreview(null);
                  setExtracted(false);
                }}
                data-testid="button-remove-image"
              >
                Cambiar imagen
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1 h-24 flex-col gap-2"
                onClick={() => cameraInputRef.current?.click()}
                data-testid="button-camera-capture"
              >
                <Camera className="h-6 w-6" />
                <span>Tomar Foto</span>
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-24 flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-image"
              >
                <Upload className="h-6 w-6" />
                <span>Cargar Imagen</span>
              </Button>
            </div>
          )}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
            }}
            data-testid="input-camera"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
            }}
            data-testid="input-file-upload"
          />
        </CardContent>
      </Card>

      {/* Invoice data form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Datos de la Factura
            {extracting && <Skeleton className="h-5 w-5 rounded-full" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="supplier">Proveedor *</Label>
              <Input
                id="supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Nombre de la ferreteria o tienda"
                data-testid="input-supplier"
                className={cn(showErrors && !supplier.trim() && "border-red-500 focus-visible:ring-red-500")}
              />
              {showErrors && !supplier.trim() && <p className="text-xs text-red-500">Campo requerido</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoiceNumber">Numero de Factura *</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Ej: 001-2024"
                data-testid="input-invoice-number"
                className={cn(showErrors && !invoiceNumber.trim() && "border-red-500 focus-visible:ring-red-500")}
              />
              {showErrors && !invoiceNumber.trim() && <p className="text-xs text-red-500">Campo requerido</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Fecha de Compra *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-testid="input-date"
                className={cn(showErrors && !date && "border-red-500 focus-visible:ring-red-500")}
              />
              {showErrors && !date && <p className="text-xs text-red-500">Campo requerido</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Categoria *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category" data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buyer">Comprador *</Label>
              <Select value={buyer} onValueChange={setBuyer}>
                <SelectTrigger
                  id="buyer"
                  data-testid="select-buyer"
                  className={cn(showErrors && !buyer && "border-red-500 focus-visible:ring-red-500")}
                >
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {BUYER_OPTIONS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showErrors && !buyer && <p className="text-xs text-red-500">Campo requerido</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="totalAmount">Total (pesos colombianos) *</Label>
              <Input
                id="totalAmount"
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="Ej: 85000"
                data-testid="input-total-amount"
                className={cn(showErrors && !totalAmount && "border-red-500 focus-visible:ring-red-500")}
              />
              {showErrors && !totalAmount && <p className="text-xs text-red-500">Campo requerido</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Descripción *</Label>
              {extracting && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Generando...
                </span>
              )}
            </div>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="El modelo de IA generará una descripción automáticamente al cargar la foto"
              rows={3}
              data-testid="input-description"
              className={cn(showErrors && !description.trim() && "border-red-500 focus-visible:ring-red-500")}
            />
            {showErrors && !description.trim() && <p className="text-xs text-red-500">Campo requerido</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas *</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones adicionales"
              rows={2}
              data-testid="input-notes"
              className={cn(showErrors && !notes.trim() && "border-red-500 focus-visible:ring-red-500")}
            />
            {showErrors && !notes.trim() && <p className="text-xs text-red-500">Campo requerido</p>}
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Articulos / Servicios</CardTitle>
          <Badge variant="outline">{items.filter((i) => i.name.trim() || i.description.trim()).length} items</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2 font-medium text-muted-foreground min-w-[140px]">Nombre Artículo</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground min-w-[160px]">Descripción Completa</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground w-20">Cant.</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground w-20">Unidad</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground w-24">P. Unit.</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground w-24">Total</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="space-y-2" data-testid="table-items">
                {items.map((item, idx) => {
                  const hasContent = item.name.trim() || item.description.trim();
                  const showItemErr = showErrors && hasContent;
                  return (
                  <tr key={idx} data-testid={`row-item-${idx}`}>
                    <td className="pr-2 py-1">
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(idx, "name", e.target.value)}
                        placeholder="Ej: Jeringa 5ml"
                        data-testid={`input-item-name-${idx}`}
                        className={cn(showItemErr && !item.name.trim() && "border-red-500 focus-visible:ring-red-500")}
                      />
                    </td>
                    <td className="pr-2 py-1">
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                        placeholder="Descripcion completa de la factura"
                        data-testid={`input-item-description-${idx}`}
                        className={cn(showItemErr && !item.description.trim() && "border-red-500 focus-visible:ring-red-500")}
                      />
                    </td>
                    <td className="pr-2 py-1">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                        placeholder="0"
                        data-testid={`input-item-quantity-${idx}`}
                        className={cn(showItemErr && !item.quantity && "border-red-500 focus-visible:ring-red-500")}
                      />
                    </td>
                    <td className="pr-2 py-1">
                      <Input
                        value={item.unit}
                        onChange={(e) => updateItem(idx, "unit", e.target.value)}
                        placeholder="und"
                        data-testid={`input-item-unit-${idx}`}
                        className={cn(showItemErr && !item.unit.trim() && "border-red-500 focus-visible:ring-red-500")}
                      />
                    </td>
                    <td className="pr-2 py-1">
                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                        placeholder="0"
                        data-testid={`input-item-unit-price-${idx}`}
                        className={cn(showItemErr && !item.unitPrice && "border-red-500 focus-visible:ring-red-500")}
                      />
                    </td>
                    <td className="pr-2 py-1">
                      <Input
                        type="number"
                        value={item.totalPrice}
                        onChange={(e) => updateItem(idx, "totalPrice", e.target.value)}
                        placeholder="0"
                        data-testid={`input-item-total-price-${idx}`}
                        className={cn(showItemErr && !item.totalPrice && "border-red-500 focus-visible:ring-red-500")}
                      />
                    </td>
                    <td className="py-1">
                      {items.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeItem(idx)}
                          data-testid={`button-remove-item-${idx}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button variant="outline" size="sm" onClick={addItem} data-testid="button-add-item">
            <Plus className="h-4 w-4 mr-2" />
            Agregar articulo
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 justify-end">
        <Link href="/invoices">
          <Button variant="outline" data-testid="button-cancel-new">Cancelar</Button>
        </Link>
        <Button
          variant="outline"
          onClick={handleValidate}
          disabled={validating || !supplier.trim()}
          data-testid="button-validate-invoice"
        >
          {validating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4 mr-2" />
          )}
          Validar con IA
        </Button>
        <Button
          onClick={handleSave}
          disabled={createMutation.isPending || !supplier.trim()}
          data-testid="button-save-invoice"
        >
          {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Guardar Factura
        </Button>
      </div>
    </div>
  );
}
