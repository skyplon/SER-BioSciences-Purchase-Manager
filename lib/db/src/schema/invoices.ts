import { pgTable, text, serial, timestamp, numeric, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number"),
  supplier: text("supplier").notNull(),
  date: text("date"),
  category: text("category").notNull().default("Otros"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
  imageBase64: text("image_base64"),
  imageObjectPath: text("image_object_path"),
  description: text("description"),
  notes: text("notes"),
  buyer: text("buyer"),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;

export const invoiceItemsTable = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 4 }),
  unit: text("unit"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }),
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItemsTable).omit({
  id: true,
});

export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  invoiceId: integer("invoice_id"),
  invoiceSupplier: text("invoice_supplier").notNull(),
  actorName: text("actor_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
