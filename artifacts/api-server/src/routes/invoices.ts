import { Router, type IRouter } from "express";
import { createHash } from "node:crypto";
import { eq, desc, sql, and, or, gte, lte, inArray, ne, isNotNull } from "drizzle-orm";
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
import { logAudit, diffSnapshots } from "../lib/audit.js";

const router: IRouter = Router();

function parseId(param: string | string[]): number {
  const raw = Array.isArray(param) ? param[0] : param;
  return parseInt(raw, 10);
}

function computeImageHash(imageBase64: string | null | undefined): string | null {
  if (!imageBase64) return null;
  const match = imageBase64.match(/^data:[^;]+;base64,(.+)$/);
  const raw = (match ? match[1] : imageBase64).trim();
  if (!raw) return null;
  return createHash("sha256").update(raw).digest("hex");
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
  const { search, category, supplier, startDate, endDate } = parsed.success ? parsed.data : {};

  const conditions = [];
  if (search) {
    const q = '%' + search.toLowerCase() + '%';
    conditions.push(sql`(
      LOWER(${invoicesTable.supplier}) LIKE ${q}
      OR LOWER(COALESCE(${invoicesTable.invoiceNumber}, '')) LIKE ${q}
      OR LOWER(COALESCE(${invoicesTable.description}, '')) LIKE ${q}
      OR LOWER(COALESCE(${invoicesTable.notes}, '')) LIKE ${q}
      OR EXISTS (
        SELECT 1 FROM ${invoiceItemsTable}
        WHERE ${invoiceItemsTable.invoiceId} = ${invoicesTable.id}
        AND LOWER(COALESCE(${invoiceItemsTable.description}, '')) LIKE ${q}
      )
    )`);
  }
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

  // Build last-12-months series (filled, including months with 0 spend)
  const monthMap: Record<string, { total: number; count: number }> = {};
  for (const inv of invoices) {
    if (!inv.date) continue;
    const m = inv.date.slice(0, 7); // "YYYY-MM"
    if (!monthMap[m]) monthMap[m] = { total: 0, count: 0 };
    monthMap[m].total += inv.totalAmount ? parseFloat(inv.totalAmount) : 0;
    monthMap[m].count++;
  }
  const now = new Date();
  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { month: m, ...(monthMap[m] ?? { total: 0, count: 0 }) };
  });

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
    byMonth,
    recentInvoices: recentWithItems,
  });
});

router.post("/invoices/bulk-delete", async (req, res): Promise<void> => {
  const body = req.body as { ids?: unknown };
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" });
    return;
  }
  const ids = (body.ids as unknown[]).filter((id): id is number => typeof id === "number" && Number.isInteger(id));
  if (ids.length === 0) {
    res.status(400).json({ error: "No valid ids provided" });
    return;
  }
  const deleted = await db.delete(invoicesTable).where(inArray(invoicesTable.id, ids)).returning();
  res.json({ deleted: deleted.length });

  for (const inv of deleted) {
    logAudit(req, {
      action: "deleted",
      entityType: "invoice",
      entityId: inv.id,
      entityLabel: inv.supplier,
      changes: {
        supplier: inv.supplier,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        category: inv.category,
        totalAmount: inv.totalAmount ? parseFloat(inv.totalAmount) : null,
      },
      metadata: { bulkDelete: true, batchSize: deleted.length },
    });
  }
});

router.get("/invoices/export", async (req, res): Promise<void> => {
  const lang = req.query["lang"] === "en" ? "en" : "es";
  const en = lang === "en";

  const rawIds = req.query["ids"];
  const filterIds = rawIds
    ? String(rawIds).split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    : null;

  const invoices = filterIds && filterIds.length > 0
    ? await db.select().from(invoicesTable).where(inArray(invoicesTable.id, filterIds)).orderBy(desc(invoicesTable.createdAt))
    : await db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt));

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

  const items = filterIds && filterIds.length > 0
    ? await db.select().from(invoiceItemsTable).where(inArray(invoiceItemsTable.invoiceId, filterIds))
    : await db.select().from(invoiceItemsTable);
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

  logAudit(req, {
    action: "exported",
    entityType: "invoice",
    entityLabel: filename,
    metadata: {
      count: invoices.length,
      itemCount: items.length,
      language: lang,
      filterIds: filterIds ?? null,
    },
  });
});

router.post("/invoices/check-duplicate", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as {
    imageBase64?: string | null;
    supplier?: string | null;
    invoiceNumber?: string | null;
    date?: string | null;
    totalAmount?: number | null;
    excludeId?: number | null;
  };

  const imageHash = computeImageHash(body.imageBase64 ?? null);
  const supplierNorm = body.supplier?.trim().toLowerCase() ?? "";
  const numberNorm = body.invoiceNumber?.trim().toLowerCase() ?? "";

  const orParts = [];
  if (imageHash) orParts.push(eq(invoicesTable.imageHash, imageHash));
  if (supplierNorm && numberNorm) {
    orParts.push(
      and(
        sql`LOWER(TRIM(${invoicesTable.supplier})) = ${supplierNorm}`,
        sql`LOWER(TRIM(COALESCE(${invoicesTable.invoiceNumber}, ''))) = ${numberNorm}`
      )!
    );
  }

  if (orParts.length === 0) {
    res.json({ duplicates: [] });
    return;
  }

  const whereExpr = body.excludeId
    ? and(or(...orParts), ne(invoicesTable.id, body.excludeId))
    : or(...orParts);

  const rows = await db
    .select({
      id: invoicesTable.id,
      supplier: invoicesTable.supplier,
      invoiceNumber: invoicesTable.invoiceNumber,
      date: invoicesTable.date,
      totalAmount: invoicesTable.totalAmount,
      createdAt: invoicesTable.createdAt,
      imageHash: invoicesTable.imageHash,
    })
    .from(invoicesTable)
    .where(whereExpr)
    .orderBy(desc(invoicesTable.createdAt))
    .limit(5);

  const duplicates = rows.map((r) => ({
    id: r.id,
    supplier: r.supplier,
    invoiceNumber: r.invoiceNumber,
    date: r.date,
    totalAmount: r.totalAmount ? parseFloat(r.totalAmount) : null,
    createdAt: r.createdAt.toISOString(),
    matchType: (imageHash && r.imageHash === imageHash ? "image" : "content") as "image" | "content",
  }));

  res.json({ duplicates });
});

router.post("/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items, imageHash: _ignoredHash, ...invoiceData } = parsed.data;
  const computedHash = computeImageHash(invoiceData.imageBase64 ?? null);

  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      ...invoiceData,
      imageHash: computedHash,
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

  logAudit(req, {
    action: "created",
    entityType: "invoice",
    entityId: invoice.id,
    entityLabel: invoice.supplier,
    changes: result ? {
      supplier: result.supplier,
      invoiceNumber: result.invoiceNumber,
      date: result.date,
      category: result.category,
      totalAmount: result.totalAmount,
      itemCount: result.items.length,
    } : null,
  });

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

  const beforeSnapshot = await getInvoiceWithItems(params.data.id);

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

  if (beforeSnapshot) {
    const before = {
      supplier: beforeSnapshot.supplier,
      invoiceNumber: beforeSnapshot.invoiceNumber,
      date: beforeSnapshot.date,
      category: beforeSnapshot.category,
      totalAmount: beforeSnapshot.totalAmount,
      description: beforeSnapshot.description,
      notes: beforeSnapshot.notes,
      buyer: beforeSnapshot.buyer,
      itemCount: beforeSnapshot.items.length,
    };
    const after = {
      supplier: result.supplier,
      invoiceNumber: result.invoiceNumber,
      date: result.date,
      category: result.category,
      totalAmount: result.totalAmount,
      description: result.description,
      notes: result.notes,
      buyer: result.buyer,
      itemCount: result.items.length,
    };
    const diff = diffSnapshots(before, after);
    if (Object.keys(diff).length > 0) {
      logAudit(req, {
        action: "updated",
        entityType: "invoice",
        entityId: params.data.id,
        entityLabel: result.supplier,
        changes: diff,
      });
    }
  }
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

  logAudit(req, {
    action: "deleted",
    entityType: "invoice",
    entityId: params.data.id,
    entityLabel: deleted.supplier,
    changes: {
      supplier: deleted.supplier,
      invoiceNumber: deleted.invoiceNumber,
      date: deleted.date,
      category: deleted.category,
      totalAmount: deleted.totalAmount ? parseFloat(deleted.totalAmount) : null,
    },
  });
});

router.get("/suppliers", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      supplier: invoicesTable.supplier,
      count: sql<number>`COUNT(*)::int`,
      total: sql<number>`COALESCE(SUM(${invoicesTable.totalAmount}::numeric), 0)::float`,
      firstDate: sql<string | null>`MIN(${invoicesTable.date})`,
      lastDate: sql<string | null>`MAX(${invoicesTable.date})`,
      categories: sql<string[]>`ARRAY_AGG(DISTINCT ${invoicesTable.category})`,
    })
    .from(invoicesTable)
    .groupBy(invoicesTable.supplier)
    .orderBy(sql`COALESCE(SUM(${invoicesTable.totalAmount}::numeric), 0) DESC NULLS LAST`);

  res.json(rows);
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
