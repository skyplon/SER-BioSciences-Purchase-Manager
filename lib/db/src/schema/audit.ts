import { pgTable, text, serial, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id"),
    entityLabel: text("entity_label"),
    userId: text("user_id").notNull(),
    userEmail: text("user_email"),
    userName: text("user_name"),
    changes: jsonb("changes").$type<Record<string, unknown> | null>(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdAtIdx: index("audit_logs_created_at_idx").on(t.createdAt),
    userIdIdx: index("audit_logs_user_id_idx").on(t.userId),
    entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
  })
);

export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertAuditLog = typeof auditLogsTable.$inferInsert;

export const auditActionSchema = z.enum([
  "created",
  "updated",
  "deleted",
  "notion_synced",
  "notion_sync_failed",
  "ocr_extracted",
  "ocr_failed",
  "exported",
]);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const auditEntityTypeSchema = z.enum(["invoice", "invoice_item", "system"]);
export type AuditEntityType = z.infer<typeof auditEntityTypeSchema>;
