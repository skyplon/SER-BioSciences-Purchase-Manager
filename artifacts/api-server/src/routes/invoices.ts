import { Router, type IRouter } from "express";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { db, invoicesTable, invoiceItemsTable, notificationsTable } from "@workspace/db";
import {
  CreateInvoiceBody,
  UpdateInvoiceBody,
  GetInvoiceParams,
  UpdateInvoiceParams,
  DeleteInvoiceParams,
  ListInvoiceItemsParams,
  ListInvoicesQueryParams,
} from "@workspace/api-zod";
import ExcelJS from "exceljs";
import { syncInvoiceToNotion } from "../lib/notion.js";
import { buildInvoiceImageUrl } from "../lib/imageUpload.js";

const router: IRouter = Router();

function parseId(param: string | string[]): number {
  const raw = Array.isArray(param) ? param[0] : param;
  return parseInt(raw, 10);
}

async function getInvoiceWithItems(id: number) {
  const invoice = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);
  if (!invoice[0]) return null;

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));

  return {
    ...invoice[0],
    totalAmount: invoice[0].totalAmount ? parseFloat(invoice[0].totalAmount) : null,
    items: items.map((item) => ({
      ...item,
      quantity: item.quantity ? parseFloat(item.quantity) : null,
      unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : null,
      totalPrice: item.totalPrice ? parseFloat(item.totalPrice) : null,
    })),
  };
}

router.get("/invoices", async (req, res): Promise<void> => {
  const parsed = ListInvoicesQueryParams.safeParse(req.query);
  const { category, supplier, startDate, endDate } = parsed.success ? parsed.data : {};

  const conditions = [];
  if (category) conditions.push(eq(invoicesTable.category, category));
  if (supplier) conditions.push(sql`LOWER(${invoicesTable.supplier}) LIKE ${'%' + supplier.toLowerCase() + '%'}`);
  if (startDate) conditions.push(gte(invoicesTable.date, startDate));
  if (endDate) conditions.push(lte(invoicesTable.date, endDate));

  const invoices = await db
    .select()
    .from(invoicesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(invoicesTable.createdAt));

  const invoicesWithItems = await Promise.all(
    invoices.map(async (inv) => {
      const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, inv.id));
      return {
        ...inv,
        totalAmount: inv.totalAmount ? parseFloat(inv.totalAmount) : null,
        items: items.map((item) => ({
          ...item,
          quantity: item.quantity ? parseFloat(item.quantity) : null,
          unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : null,
          totalPrice: item.totalPrice ? parseFloat(item.totalPrice) : null,
        })),
      };
    })
  );

  res.json(invoicesWithItems);
});

router.get("/invoices/summary", async (_req, res): Promise<void> => {
  const invoices = await db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt));

  const totalAmount = invoices.reduce((acc, inv) => acc + (inv.totalAmount ? parseFloat(inv.totalAmount) : 0), 0);

  const categoryMap: Record<string, { count: number; total: number }> = {};
  const supplierMap: Record<string, { count: number; total: number }> = {};

  for (const inv of invoices) {
    const amt = inv.totalAmount ? parseFloat(inv.totalAmount) : 0;

    if (!categoryMap[inv.category]) categoryMap[inv.category] = { count: 0, total: 0 };
    categoryMap[inv.category].count++;
    categoryMap[inv.category].total += amt;

    if (!supplierMap[inv.supplier]) supplierMap[inv.supplier] = { count: 0, total: 0 };
    supplierMap[inv.supplier].count++;
    supplierMap[inv.supplier].total += amt;
  }

  const byCategory = Object.entries(categoryMap)
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.total - a.total);

  const bySupplier = Object.entries(supplierMap)
    .map(([supplier, data]) => ({ supplier, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const recentInvoices = invoices.slice(0, 5);
  const recentWithItems = await Promise.all(
    recentInvoices.map(async (inv) => {
      const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, inv.id));
      return {
        ...inv,
        totalAmount: inv.totalAmount ? parseFloat(inv.totalAmount) : null,
        items: items.map((item) => ({
          ...item,
          quantity: item.quantity ? parseFloat(item.quantity) : null,
          unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : null,
          totalPrice: item.totalPrice ? parseFloat(item.totalPrice) : null,
        })),
      };
    })
  );

  res.json({
    totalInvoices: invoices.length,
    totalAmount,
    byCategory,
    bySupplier,
    recentInvoices: recentWithItems,
  });
});

router.get("/invoices/export", async (req, res): Promise<void> => {
  const lang = req.query["lang"] === "en" ? "en" : "es";
  const en = lang === "en";

  const invoices = await db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gestor de Facturas Finca";
  workbook.created = new Date();

  const invoiceSheet = workbook.addWorksheet(en ? "Invoices" : "Facturas");
  invoiceSheet.columns = [
    { header: en ? "Invoice ID" : "ID Factura", key: "id", width: 12 },
    { header: en ? "Invoice Number" : "Numero Factura", key: "invoiceNumber", width: 20 },
    { header: en ? "Supplier" : "Proveedor", key: "supplier", width: 25 },
    { header: en ? "Purchase Date" : "Fecha Compra", key: "date", width: 15 },
    { header: en ? "Category" : "Categoria", key: "category", width: 20 },
    { header: en ? "Total Cost" : "Costo Total", key: "totalAmount", width: 15 },
    { header: en ? "Description" : "Descripcion", key: "description", width: 60 },
    { header: en ? "Notes" : "Notas", key: "notes", width: 40 },
    { header: en ? "Buyer" : "Comprador", key: "buyer", width: 20 },
    { header: en ? "Registration Date" : "Fecha Registro", key: "createdAt", width: 20 },
    { header: en ? "Created By" : "Creado Por", key: "createdBy", width: 20 },
    { header: en ? "Last Modified" : "Fecha Modificación", key: "updatedAt", width: 20 },
    { header: en ? "Modified By" : "Modificado Por", key: "updatedBy", width: 20 },
  ];

  invoiceSheet.getRow(1).font = { bold: true };

  for (const inv of invoices) {
    invoiceSheet.addRow({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber ?? "",
      supplier: inv.supplier,
      date: inv.date ?? "",
      category: inv.category,
      totalAmount: inv.totalAmount ? parseFloat(inv.totalAmount) : "",
      description: inv.description ?? "",
      notes: inv.notes ?? "",
      buyer: inv.buyer ?? "",
      createdBy: inv.createdBy ?? "",
      createdAt: inv.createdAt.toISOString().split("T")[0],
      updatedAt: inv.updatedAt ? inv.updatedAt.toISOString().split("T")[0] : "",
      updatedBy: inv.updatedBy ?? "",
    });
  }

  const supplierMap = new Map(invoices.map((inv) => [inv.id, inv.supplier]));

  const itemsSheet = workbook.addWorksheet(en ? "Items" : "Items");
  itemsSheet.columns = [
    { header: en ? "Item ID" : "ID Item", key: "id", width: 10 },
    { header: en ? "Invoice ID" : "ID Factura", key: "invoiceId", width: 12 },
    { header: en ? "Supplier" : "Proveedor", key: "supplier", width: 25 },
    { header: en ? "Item Name" : "Nombre Articulo", key: "name", width: 30 },
    { header: en ? "Description" : "Descripcion", key: "description", width: 40 },
    { header: en ? "Qty." : "Cantidad", key: "quantity", width: 12 },
    { header: en ? "Unit" : "Unidad", key: "unit", width: 12 },
    { header: en ? "Unit Price" : "Precio Unitario", key: "unitPrice", width: 16 },
    { header: en ? "Total" : "Total", key: "totalPrice", width: 15 },
  ];
  itemsSheet.getRow(1).font = { bold: true };

  const items = await db.select().from(invoiceItemsTable);
  for (const item of items) {
    itemsSheet.addRow({
      id: item.id,
      invoiceId: item.invoiceId,
      supplier: supplierMap.get(item.invoiceId ?? 0) ?? "",
      name: item.name ?? "",
      description: item.description,
      quantity: item.quantity ? parseFloat(item.quantity) : "",
      unit: item.unit ?? "",
      unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : "",
      totalPrice: item.totalPrice ? parseFloat(item.totalPrice) : "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileBase64 = Buffer.from(buffer).toString("base64");
  const today = new Date().toISOString().split("T")[0];
  const filename = en ? `invoices_${today}.xlsx` : `facturas_${today}.xlsx`;

  res.json({ fileBase64, filename });
});

router.post("/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items, ...invoiceData } = parsed.data;

  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      ...invoiceData,
      totalAmount: invoiceData.totalAmount != null ? String(invoiceData.totalAmount) : null,
    })
    .returning();

  if (items && items.length > 0) {
    await db.insert(invoiceItemsTable).values(
      items.map((item) => ({
        invoiceId: invoice.id,
        name: item.name ?? item.description,
        description: item.description,
        quantity: item.quantity != null ? String(item.quantity) : null,
        unit: item.unit ?? null,
        unitPrice: item.unitPrice != null ? String(item.unitPrice) : null,
        totalPrice: item.totalPrice != null ? String(item.totalPrice) : null,
      }))
    );
  }

  const result = await getInvoiceWithItems(invoice.id);
  res.status(201).json(result);

  db.insert(notificationsTable).values({
    type: "created",
    invoiceId: invoice.id,
    invoiceSupplier: invoice.supplier,
    actorName: invoiceData.createdBy ?? null,
  }).catch(() => {});

  if (result) {
    syncInvoiceToNotion({
      id: result.id,
      invoiceNumber: result.invoiceNumber ?? null,
      supplier: result.supplier,
      date: result.date ?? null,
      category: result.category,
      totalAmount: result.totalAmount ?? null,
      description: result.description ?? null,
      notes: result.notes ?? null,
      buyer: result.buyer ?? null,
      createdAt: result.createdAt,
      imageUrl: result.imageBase64 ? buildInvoiceImageUrl(result.id) : null,
      items: result.items.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        unitPrice: item.unitPrice ?? null,
        totalPrice: item.totalPrice ?? null,
      })),
    }).catch((err) => {
      console.error("Error sincronizando con Notion:", err?.message ?? err);
    });
  }
});

router.get("/invoices/:id/image", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).end(); return; }

  const rows = await db.select({ imageBase64: invoicesTable.imageBase64 })
    .from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);

  const imageBase64 = rows[0]?.imageBase64;
  if (!imageBase64) { res.status(404).end(); return; }

  const dataMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
  const contentType = dataMatch ? dataMatch[1] : "image/jpeg";
  const rawBase64 = dataMatch ? dataMatch[2] : imageBase64;
  const buffer = Buffer.from(rawBase64, "base64");

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000");
  res.send(buffer);
});

router.get("/invoices/:id", async (req, res): Promise<void> => {
  const params = GetInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await getInvoiceWithItems(params.data.id);
  if (!result) {
    res.status(404).json({ error: "Factura no encontrada" });
    return;
  }

  res.json(result);
});

router.patch("/invoices/:id", async (req, res): Promise<void> => {
  const params = UpdateInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items, ...invoiceData } = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (invoiceData.invoiceNumber !== undefined) updateData.invoiceNumber = invoiceData.invoiceNumber;
  if (invoiceData.supplier !== undefined) updateData.supplier = invoiceData.supplier;
  if (invoiceData.date !== undefined) updateData.date = invoiceData.date;
  if (invoiceData.category !== undefined) updateData.category = invoiceData.category;
  if (invoiceData.totalAmount !== undefined) updateData.totalAmount = invoiceData.totalAmount != null ? String(invoiceData.totalAmount) : null;
  if (invoiceData.description !== undefined) updateData.description = invoiceData.description;
  if (invoiceData.notes !== undefined) updateData.notes = invoiceData.notes;
  if (invoiceData.buyer !== undefined) updateData.buyer = invoiceData.buyer;
  if (invoiceData.updatedBy !== undefined) updateData.updatedBy = invoiceData.updatedBy;

  if (Object.keys(updateData).length > 0) {
    const [updated] = await db
      .update(invoicesTable)
      .set(updateData)
      .where(eq(invoicesTable.id, params.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Factura no encontrada" });
      return;
    }
  }

  if (items !== undefined) {
    await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, params.data.id));
    if (items.length > 0) {
      await db.insert(invoiceItemsTable).values(
        items.map((item) => ({
          invoiceId: params.data.id,
          name: item.name ?? item.description,
          description: item.description,
          quantity: item.quantity != null ? String(item.quantity) : null,
          unit: item.unit ?? null,
          unitPrice: item.unitPrice != null ? String(item.unitPrice) : null,
          totalPrice: item.totalPrice != null ? String(item.totalPrice) : null,
        }))
      );
    }
  }

  const result = await getInvoiceWithItems(params.data.id);
  if (!result) {
    res.status(404).json({ error: "Factura no encontrada" });
    return;
  }

  res.json(result);

  db.insert(notificationsTable).values({
    type: "updated",
    invoiceId: params.data.id,
    invoiceSupplier: result.supplier,
    actorName: invoiceData.updatedBy ?? null,
  }).catch(() => {});
});

router.delete("/invoices/:id", async (req, res): Promise<void> => {
  const params = DeleteInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(invoicesTable)
    .where(eq(invoicesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Factura no encontrada" });
    return;
  }

  res.sendStatus(204);

  db.insert(notificationsTable).values({
    type: "deleted",
    invoiceId: null,
    invoiceSupplier: deleted.supplier,
    actorName: null,
  }).catch(() => {});
});

router.get("/invoices/:id/items", async (req, res): Promise<void> => {
  const params = ListInvoiceItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const items = await db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, params.data.id));

  res.json(
    items.map((item) => ({
      ...item,
      quantity: item.quantity ? parseFloat(item.quantity) : null,
      unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : null,
      totalPrice: item.totalPrice ? parseFloat(item.totalPrice) : null,
    }))
  );
});

export default router;
