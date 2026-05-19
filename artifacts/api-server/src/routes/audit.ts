import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte, sql, count } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db, auditLogsTable } from "@workspace/db";
import { requireAdmin } from "../lib/audit.js";
import { getEffectiveRole } from "../lib/roles.js";

const router: IRouter = Router();

router.get("/me/role", async (req, res): Promise<void> => {
  const eff = await getEffectiveRole(req);
  res.json({
    role: eff.effective,
    actualRole: eff.actual,
    isAdmin: eff.actual === "admin",
    isEditor: eff.effective === "editor" || eff.effective === "admin",
    isImpersonating: eff.isImpersonating,
  });
});

router.use("/audit-logs", requireAdmin);

router.get("/audit-logs", async (req, res): Promise<void> => {
  const { search, action, entityType, entityId, userId, startDate, endDate, limit } = req.query;

  const conditions = [];
  if (action && typeof action === "string") conditions.push(eq(auditLogsTable.action, action));
  if (entityType && typeof entityType === "string") conditions.push(eq(auditLogsTable.entityType, entityType));
  if (entityId && !Array.isArray(entityId)) {
    const id = parseInt(String(entityId), 10);
    if (!isNaN(id)) conditions.push(eq(auditLogsTable.entityId, id));
  }
  if (userId && typeof userId === "string") conditions.push(eq(auditLogsTable.userId, userId));
  if (startDate && typeof startDate === "string") {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) conditions.push(gte(auditLogsTable.createdAt, start));
  }
  if (endDate && typeof endDate === "string") {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogsTable.createdAt, end));
    }
  }
  if (search && typeof search === "string") {
    const q = "%" + search.toLowerCase() + "%";
    conditions.push(sql`(
      LOWER(COALESCE(${auditLogsTable.entityLabel}, '')) LIKE ${q}
      OR LOWER(COALESCE(${auditLogsTable.userName}, '')) LIKE ${q}
      OR LOWER(COALESCE(${auditLogsTable.userEmail}, '')) LIKE ${q}
      OR LOWER(${auditLogsTable.action}) LIKE ${q}
    )`);
  }

  const limitNum = limit ? Math.min(parseInt(String(limit), 10) || 500, 2000) : 500;

  const logs = await db
    .select()
    .from(auditLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limitNum);

  res.json(
    logs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
  );
});

router.get("/audit-logs/stats", async (_req, res): Promise<void> => {
  const now = new Date();
  const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalRow] = await db.select({ c: count() }).from(auditLogsTable);
  const [r24] = await db.select({ c: count() }).from(auditLogsTable).where(gte(auditLogsTable.createdAt, day1));
  const [r7] = await db.select({ c: count() }).from(auditLogsTable).where(gte(auditLogsTable.createdAt, day7));
  const [r30] = await db.select({ c: count() }).from(auditLogsTable).where(gte(auditLogsTable.createdAt, day30));

  const byAction = await db
    .select({ action: auditLogsTable.action, count: count() })
    .from(auditLogsTable)
    .groupBy(auditLogsTable.action)
    .orderBy(desc(count()));

  const byUser = await db
    .select({
      userId: auditLogsTable.userId,
      userName: auditLogsTable.userName,
      userEmail: auditLogsTable.userEmail,
      count: count(),
    })
    .from(auditLogsTable)
    .groupBy(auditLogsTable.userId, auditLogsTable.userName, auditLogsTable.userEmail)
    .orderBy(desc(count()))
    .limit(10);

  const byEntityType = await db
    .select({ entityType: auditLogsTable.entityType, count: count() })
    .from(auditLogsTable)
    .groupBy(auditLogsTable.entityType)
    .orderBy(desc(count()));

  const recentActivity = await db
    .select({
      day: sql<string>`TO_CHAR(${auditLogsTable.createdAt}, 'YYYY-MM-DD')`,
      count: count(),
    })
    .from(auditLogsTable)
    .where(gte(auditLogsTable.createdAt, day30))
    .groupBy(sql`TO_CHAR(${auditLogsTable.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${auditLogsTable.createdAt}, 'YYYY-MM-DD')`);

  res.json({
    totalEvents: totalRow?.c ?? 0,
    last24h: r24?.c ?? 0,
    last7d: r7?.c ?? 0,
    last30d: r30?.c ?? 0,
    byAction: byAction.map((r) => ({ action: r.action, count: r.count })),
    byUser: byUser.map((r) => ({ userId: r.userId, userName: r.userName, userEmail: r.userEmail, count: r.count })),
    byEntityType: byEntityType.map((r) => ({ entityType: r.entityType, count: r.count })),
    recentActivity: recentActivity.map((r) => ({ day: r.day, count: r.count })),
  });
});

router.get("/audit-logs/export", async (_req, res): Promise<void> => {
  const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(10000);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Audit Log");
  ws.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Fecha/Hora", key: "createdAt", width: 22 },
    { header: "Acción", key: "action", width: 18 },
    { header: "Tipo de Entidad", key: "entityType", width: 16 },
    { header: "ID Entidad", key: "entityId", width: 10 },
    { header: "Etiqueta", key: "entityLabel", width: 28 },
    { header: "Usuario", key: "userName", width: 22 },
    { header: "Email", key: "userEmail", width: 28 },
    { header: "User ID", key: "userId", width: 30 },
    { header: "Cambios (JSON)", key: "changes", width: 60 },
    { header: "Metadata (JSON)", key: "metadata", width: 30 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const l of logs) {
    ws.addRow({
      id: l.id,
      createdAt: l.createdAt.toISOString(),
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId ?? "",
      entityLabel: l.entityLabel ?? "",
      userName: l.userName ?? "",
      userEmail: l.userEmail ?? "",
      userId: l.userId,
      changes: l.changes ? JSON.stringify(l.changes) : "",
      metadata: l.metadata ? JSON.stringify(l.metadata) : "",
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const fileBase64 = Buffer.from(buf).toString("base64");
  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.json({ fileBase64, filename });
});

export default router;
