import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useExtractInvoiceData, useValidateInvoiceData, useCreateInvoice, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
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
import { Camera, Upload, Plus, Trash2, ArrowLeft, Loader2, CheckCircle, ShieldCheck, FileType, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CATEGORY_OPTIONS } from "@/lib/categories";
import { BUYER_OPTIONS } from "@/lib/buyers";
import { Link } from "wouter";
import { useT } from "@/lib/i18n";
import { AiProgressSteps } from "@/components/ai-progress-steps";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

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
  const { getToken } = useAuth();
  const { user } = useUser();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const unifiedFileInputRef = useRef<HTMLInputElement>(null);

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
  const [docxName, setDocxName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [validating, setValidating] = useState(false);
  const [completing, setCompleting] = useState(false);

  type AiMode = "extract" | "validate" | "complete";
  const [aiStep, setAiStep] = useState(0);
  const [aiMode, setAiMode] = useState<AiMode>("extract");
  const [aiDone, setAiDone] = useState(false);
  const [aiError, setAiError] = useState(false);
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearStepTimers = () => {
    stepTimersRef.current.forEach(clearTimeout);
    stepTimersRef.current = [];
  };

  const scheduleAiStep = (step: number, delay: number) => {
    const id = setTimeout(() => setAiStep(step), delay);
    stepTimersRef.current.push(id);
  };

  const finishAi = (success: boolean) => {
    clearStepTimers();
    if (success) {
      setAiDone(true);
      const id = setTimeout(() => { setAiStep(0); setAiDone(false); }, 2500);
      stepTimersRef.current.push(id);
    } else {
      setAiError(true);
      const id = setTimeout(() => { setAiStep(0); setAiError(false); }, 3000);
      stepTimersRef.current.push(id);
    }
  };

  const t = useT();
  const extractMutation = useExtractInvoiceData();
  const validateMutation = useValidateInvoiceData();
  const createMutation = useCreateInvoice({
    mutation: {
      onSuccess: (invoice) => {
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        toast({ title: t("invoiceNew.savedOk") });
        setLocation(`/invoices/${invoice.id}`);
      },
      onError: () => {
        toast({ title: t("invoiceNew.saveError"), variant: "destructive" });
      },
    },
  });

  const handleImageFile = (file: File) => {
    setAiMode("extract");
    setAiDone(false);
    setAiError(false);
    clearStepTimers();
    setAiStep(1);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setDocxName(null);
      const base64 = dataUrl.split(",")[1];
      setImageBase64(base64);
      handleExtract(base64);
    };
    reader.readAsDataURL(file);
  };

  const handlePdfFile = async (file: File) => {
    setAiMode("extract");
    setAiDone(false);
    setAiError(false);
    clearStepTimers();
    setAiStep(1);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const base64 = dataUrl.split(",")[1];
      setImagePreview(dataUrl);
      setImageBase64(base64);
      setDocxName(null);
      handleExtract(base64);
    } catch {
      toast({ title: t("invoiceNew.pdfError"), variant: "destructive" });
      setAiStep(0);
    }
  };

  const handleUnifiedFile = (file: File) => {
    if (file.type.startsWith("image/")) {
      handleImageFile(file);
    } else if (file.type === "application/pdf") {
      handlePdfFile(file);
    } else {
      handleDocxFile(file);
    }
  };

  const handleDocxFile = async (file: File) => {
    setAiMode("extract");
    setAiDone(false);
    setAiError(false);
    clearStepTimers();
    setAiStep(1);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value.trim();
      if (!text) {
        toast({ title: t("invoiceNew.wordNoText"), variant: "destructive" });
        setAiStep(0);
        return;
      }
      setDocxName(file.name);
      setImagePreview(null);
      setImageBase64(null);
      setExtracting(true);
      setExtracted(false);
      setAiStep(2);
      scheduleAiStep(3, 2000);
      scheduleAiStep(4, 5000);
      const token = await getToken();
      const response = await fetch("/api/ocr/extract-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("API error");
      const data = await response.json() as Record<string, unknown>;
      if (data.supplier) setSupplier(data.supplier as string);
      if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber as string);
      if (data.date) setDate(data.date as string);
      if (data.category) setCategory(data.category as string);
      if (data.totalAmount != null) setTotalAmount(String(data.totalAmount));
      if (data.description) setDescription(data.description as string);
      if (data.notes) setNotes(data.notes as string);
      const rawItems = data.items as Array<Record<string, unknown>> | undefined;
      if (rawItems && rawItems.length > 0) {
        setItems(rawItems.map((item) => ({
          name: String(item.name ?? ""),
          description: String(item.description ?? ""),
          quantity: item.quantity != null ? String(item.quantity) : "",
          unit: String(item.unit ?? ""),
          unitPrice: item.unitPrice != null ? String(item.unitPrice) : "",
          totalPrice: item.totalPrice != null ? String(item.totalPrice) : "",
        })));
      }
      setExtracted(true);
      finishAi(true);
      toast({ title: t("invoiceNew.wordExtracted") });
    } catch {
      toast({ title: t("invoiceNew.wordError"), variant: "destructive" });
      finishAi(false);
    } finally {
      setExtracting(false);
    }
  };

  const handleExtract = async (base64: string) => {
    setExtracting(true);
    setExtracted(false);
    setAiStep(2);
    scheduleAiStep(3, 2500);
    scheduleAiStep(4, 6000);
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
      finishAi(true);
      toast({ title: t("invoiceNew.extractedOk") });
    } catch {
      toast({ title: t("invoiceNew.extractError"), variant: "destructive" });
      finishAi(false);
    } finally {
      setExtracting(false);
    }
  };

  const handleValidate = async () => {
    setAiMode("validate");
    setAiDone(false);
    setAiError(false);
    clearStepTimers();
    setAiStep(1);
    scheduleAiStep(2, 1800);
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
      finishAi(true);
      toast({ title: t("invoiceNew.validateOk") });
    } catch {
      toast({ title: t("invoiceNew.validateError"), variant: "destructive" });
      finishAi(false);
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

  const handleFillPrices = () => {
    let filled = 0;
    const updated = items.map((item) => {
      const qty = parseFloat(item.quantity);
      const unit = parseFloat(item.unitPrice);
      const total = parseFloat(item.totalPrice);
      let next = { ...item };

      if ((!item.unitPrice || unit === 0) && total > 0 && qty > 0) {
        next.unitPrice = String(Math.round(total / qty));
        filled++;
      } else if ((!item.totalPrice || total === 0) && unit > 0 && qty > 0) {
        next.totalPrice = String(Math.round(unit * qty));
        filled++;
      }
      return next;
    });
    setItems(updated);
    return { updated, filled };
  };

  const handleComplete = async () => {
    setAiMode("complete");
    setAiDone(false);
    setAiError(false);
    clearStepTimers();
    setAiStep(1);
    scheduleAiStep(2, 1500);
    setCompleting(true);
    try {
      const { updated } = handleFillPrices();
      const completedItems = updated.filter((i) => i.name.trim() || i.description.trim());

      const token = await getToken();
      const response = await fetch("/api/ocr/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          imageBase64: imageBase64 || null,
          invoiceNumber: invoiceNumber || null,
          supplier: supplier || null,
          date: date || null,
          category: category || null,
          totalAmount: totalAmount ? parseFloat(totalAmount) : null,
          description: description || null,
          notes: notes || null,
          items: completedItems.map((i) => ({
            name: i.name.trim() || i.description.trim(),
            description: i.description.trim() || i.name.trim(),
            quantity: i.quantity ? parseFloat(i.quantity) : null,
            unit: i.unit.trim() || null,
            unitPrice: i.unitPrice ? parseFloat(i.unitPrice) : null,
            totalPrice: i.totalPrice ? parseFloat(i.totalPrice) : null,
          })),
        }),
      });
      if (!response.ok) throw new Error("API error");
      const data = await response.json() as Record<string, unknown>;

      if (data.supplier) setSupplier(data.supplier as string);
      if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber as string);
      if (data.date) setDate(data.date as string);
      if (data.category) setCategory(data.category as string);
      if (data.totalAmount != null) setTotalAmount(String(data.totalAmount));
      if (data.description) setDescription(data.description as string);
      if (data.notes) setNotes(data.notes as string);
      const rawItems = data.items as Array<Record<string, unknown>> | undefined;
      if (rawItems && rawItems.length > 0) {
        setItems(rawItems.map((item) => ({
          name: String(item.name ?? ""),
          description: String(item.description ?? ""),
          quantity: item.quantity != null ? String(item.quantity) : "",
          unit: String(item.unit ?? ""),
          unitPrice: item.unitPrice != null ? String(item.unitPrice) : "",
          totalPrice: item.totalPrice != null ? String(item.totalPrice) : "",
        })));
      }
      finishAi(true);
      toast({ title: t("invoiceNew.completeOk") });
    } catch {
      toast({ title: t("invoiceNew.completeError"), variant: "destructive" });
      finishAi(false);
    } finally {
      setCompleting(false);
    }
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

    const createdBy = user?.fullName ?? user?.firstName ?? null;
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
        createdBy,
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
          <h2 className="text-2xl font-bold text-foreground">{t("invoiceNew.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("invoiceNew.subtitle")}</p>
        </div>
      </div>

      {/* Image capture */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("invoiceNew.fileSection")}</CardTitle>
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
                  <div className="absolute inset-0 bg-background/40 rounded" />
                )}
              </div>
              {extracted && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {t("invoiceNew.extracted")}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setImageBase64(null); setImagePreview(null); setExtracted(false); }}
                data-testid="button-remove-image"
              >
                {t("invoiceNew.changeFile")}
              </Button>
            </div>
          ) : docxName ? (
            <div className="space-y-3">
              <div className={cn("flex items-center gap-3 p-4 rounded border border-border bg-muted/40", extracting && "opacity-60")}>
                <FileType className="h-8 w-8 text-blue-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{docxName}</p>
                  <p className="text-xs text-muted-foreground">{t("invoiceNew.wordDoc")}</p>
                </div>
              </div>
              {extracted && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {t("invoiceNew.extracted")}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setDocxName(null); setExtracted(false); }}
                data-testid="button-remove-image"
              >
                {t("invoiceNew.changeFile")}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-28 flex-col gap-2"
                onClick={() => cameraInputRef.current?.click()}
                data-testid="button-camera-capture"
              >
                <Camera className="h-7 w-7" />
                <span className="text-sm font-medium">{t("invoiceNew.takePhoto")}</span>
              </Button>
              <Button
                variant="outline"
                className="h-28 flex-col gap-2"
                onClick={() => unifiedFileInputRef.current?.click()}
                data-testid="button-upload-image"
              >
                <Upload className="h-7 w-7" />
                <span className="text-sm font-medium">{t("invoiceNew.uploadFile")}</span>
                <span className="text-xs text-muted-foreground">Imagen, PDF o Word</span>
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
            ref={unifiedFileInputRef}
            type="file"
            accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUnifiedFile(file);
            }}
            data-testid="input-file-upload"
          />
        </CardContent>
      </Card>

      {aiStep > 0 && aiMode === "extract" && (
        <AiProgressSteps
          title={t("aiSteps.extractTitle")}
          steps={docxName ? [
            t("aiSteps.step.readingText"),
            t("aiSteps.step.sendingToAi"),
            t("aiSteps.step.analyzingDoc"),
            t("aiSteps.step.extractingFields"),
          ] : [
            t("aiSteps.step.readingDoc"),
            t("aiSteps.step.sendingToAi"),
            t("aiSteps.step.analyzingInvoice"),
            t("aiSteps.step.extractingFields"),
          ]}
          currentStep={aiStep}
          done={aiDone}
          error={aiError}
          doneLabel={t("aiSteps.doneExtract")}
          errorLabel={t("aiSteps.error")}
        />
      )}

      {/* Invoice data form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("invoiceNew.dataSection")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="supplier">{t("invoiceNew.supplier")} *</Label>
              <Input
                id="supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder={t("invoiceNew.supplierPlaceholder")}
                data-testid="input-supplier"
                className={cn(showErrors && !supplier.trim() && "border-red-500 focus-visible:ring-red-500")}
              />
              {showErrors && !supplier.trim() && <p className="text-xs text-red-500">{t("invoiceNew.required")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoiceNumber">{t("invoiceNew.invoiceNumber")} *</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder={t("invoiceNew.invoiceNumberPlaceholder")}
                data-testid="input-invoice-number"
                className={cn(showErrors && !invoiceNumber.trim() && "border-red-500 focus-visible:ring-red-500")}
              />
              {showErrors && !invoiceNumber.trim() && <p className="text-xs text-red-500">{t("invoiceNew.required")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">{t("invoiceNew.purchaseDate")} *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-testid="input-date"
                className={cn(showErrors && !date && "border-red-500 focus-visible:ring-red-500")}
              />
              {showErrors && !date && <p className="text-xs text-red-500">{t("invoiceNew.required")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">{t("invoiceNew.category")} *</Label>
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
              <Label htmlFor="buyer">{t("invoiceNew.buyer")} *</Label>
              <Select value={buyer} onValueChange={setBuyer}>
                <SelectTrigger
                  id="buyer"
                  data-testid="select-buyer"
                  className={cn(showErrors && !buyer && "border-red-500 focus-visible:ring-red-500")}
                >
                  <SelectValue placeholder={t("common.search")} />
                </SelectTrigger>
                <SelectContent>
                  {BUYER_OPTIONS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showErrors && !buyer && <p className="text-xs text-red-500">{t("invoiceNew.required")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="totalAmount">{t("invoiceNew.total")} *</Label>
              <Input
                id="totalAmount"
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder={t("invoiceNew.totalPlaceholder")}
                data-testid="input-total-amount"
                className={cn(showErrors && !totalAmount && "border-red-500 focus-visible:ring-red-500")}
              />
              {showErrors && !totalAmount && <p className="text-xs text-red-500">{t("invoiceNew.required")}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">{t("invoiceNew.description")} *</Label>
            </div>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("invoiceNew.descriptionPlaceholder")}
              rows={3}
              data-testid="input-description"
              className={cn(showErrors && !description.trim() && "border-red-500 focus-visible:ring-red-500")}
            />
            {showErrors && !description.trim() && <p className="text-xs text-red-500">{t("invoiceNew.required")}</p>}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes">{t("invoiceNew.notes")} *</Label>
            </div>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("invoiceNew.notesPlaceholder")}
              rows={3}
              data-testid="input-notes"
              className={cn("resize-y", showErrors && !notes.trim() && "border-red-500 focus-visible:ring-red-500")}
            />
            {showErrors && !notes.trim() && <p className="text-xs text-red-500">{t("invoiceNew.required")}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("invoiceNew.items")}</CardTitle>
          <Badge variant="outline">{items.filter((i) => i.name.trim() || i.description.trim()).length} items</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2 font-medium text-muted-foreground min-w-[140px]">{t("invoiceNew.itemName")}</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground min-w-[160px]">{t("invoiceNew.itemDescription")}</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground w-20">{t("invoiceNew.itemQty")}</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground w-20">{t("invoiceNew.itemUnit")}</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground w-24">{t("invoiceNew.itemUnitPrice")}</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground w-24">{t("invoiceNew.itemTotal")}</th>
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
                        placeholder={t("invoiceNew.itemNamePlaceholder")}
                        data-testid={`input-item-name-${idx}`}
                        className={cn(showItemErr && !item.name.trim() && "border-red-500 focus-visible:ring-red-500")}
                      />
                    </td>
                    <td className="pr-2 py-1">
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                        placeholder={t("invoiceNew.itemDescPlaceholder")}
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

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3" data-testid="table-items">
            {items.map((item, idx) => {
              const hasContent = item.name.trim() || item.description.trim();
              const showItemErr = showErrors && hasContent;
              return (
                <div key={idx} className="border border-border rounded-lg p-3 space-y-2" data-testid={`row-item-${idx}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                    {items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeItem(idx)}
                        data-testid={`button-remove-item-${idx}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">{t("invoiceNew.itemName")}</label>
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(idx, "name", e.target.value)}
                        placeholder={t("invoiceNew.itemNamePlaceholder")}
                        data-testid={`input-item-name-${idx}`}
                        className={cn(showItemErr && !item.name.trim() && "border-red-500 focus-visible:ring-red-500")}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">{t("invoiceNew.itemDescription")}</label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                        placeholder={t("invoiceNew.itemDescPlaceholder")}
                        data-testid={`input-item-description-${idx}`}
                        className={cn(showItemErr && !item.description.trim() && "border-red-500 focus-visible:ring-red-500")}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">{t("invoiceNew.itemQty")}</label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                          placeholder="0"
                          data-testid={`input-item-quantity-${idx}`}
                          className={cn(showItemErr && !item.quantity && "border-red-500 focus-visible:ring-red-500")}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">{t("invoiceNew.itemUnit")}</label>
                        <Input
                          value={item.unit}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)}
                          placeholder="und"
                          data-testid={`input-item-unit-${idx}`}
                          className={cn(showItemErr && !item.unit.trim() && "border-red-500 focus-visible:ring-red-500")}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">{t("invoiceNew.itemUnitPrice")}</label>
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                          placeholder="0"
                          data-testid={`input-item-unit-price-${idx}`}
                          className={cn(showItemErr && !item.unitPrice && "border-red-500 focus-visible:ring-red-500")}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">{t("invoiceNew.itemTotal")}</label>
                        <Input
                          type="number"
                          value={item.totalPrice}
                          onChange={(e) => updateItem(idx, "totalPrice", e.target.value)}
                          placeholder="0"
                          data-testid={`input-item-total-price-${idx}`}
                          className={cn(showItemErr && !item.totalPrice && "border-red-500 focus-visible:ring-red-500")}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Button variant="outline" size="sm" onClick={addItem} data-testid="button-add-item">
            <Plus className="h-4 w-4 mr-2" />
            {t("invoiceNew.addItem")}
          </Button>
        </CardContent>
      </Card>

      {aiStep > 0 && aiMode !== "extract" && (
        <AiProgressSteps
          title={aiMode === "validate" ? t("aiSteps.validateTitle") : t("aiSteps.completeTitle")}
          steps={aiMode === "validate" ? [
            t("aiSteps.step.reviewingFields"),
            t("aiSteps.step.fixingWithAi"),
          ] : [
            t("aiSteps.step.preparingData"),
            t("aiSteps.step.completingWithAi"),
          ]}
          currentStep={aiStep}
          done={aiDone}
          error={aiError}
          doneLabel={aiMode === "validate" ? t("aiSteps.doneValidate") : t("aiSteps.doneComplete")}
          errorLabel={t("aiSteps.error")}
        />
      )}

      {/* Mobile: 2x2 grid; Desktop: row right-aligned */}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-end sm:gap-3">
        <Link href="/invoices" className="contents">
          <Button variant="outline" className="w-full sm:w-auto" data-testid="button-cancel-new">{t("invoiceNew.cancel")}</Button>
        </Link>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={handleComplete}
          disabled={completing || extracting}
          data-testid="button-complete-invoice"
        >
          {completing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4 mr-2" />
          )}
          {t("invoiceNew.completeAI")}
        </Button>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={handleValidate}
          disabled={validating || completing || extracting}
          data-testid="button-validate-invoice"
        >
          {validating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4 mr-2" />
          )}
          {t("invoiceNew.validateAI")}
        </Button>
        <Button
          className="w-full sm:w-auto"
          onClick={handleSave}
          disabled={createMutation.isPending || !supplier.trim()}
          data-testid="button-save-invoice"
        >
          {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t("invoiceNew.saveInvoice")}
        </Button>
      </div>
    </div>
  );
}
