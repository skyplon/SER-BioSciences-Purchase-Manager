import { Client } from "@notionhq/client";

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const FACTURAS_DB_ID = process.env.NOTION_FACTURAS_DB_ID;
const ITEMS_DB_ID = process.env.NOTION_ITEMS_DB_ID;

function getClient(): Client {
  if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY no configurada");
  return new Client({ auth: NOTION_API_KEY });
}

export interface NotionInvoiceItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface NotionInvoice {
  id: number;
  invoiceNumber: string | null;
  supplier: string;
  date: string | null;
  category: string;
  totalAmount: number | null;
  notes: string | null;
  createdAt: Date;
  items: NotionInvoiceItem[];
}

export async function syncInvoiceToNotion(invoice: NotionInvoice): Promise<void> {
  if (!NOTION_API_KEY || !FACTURAS_DB_ID || !ITEMS_DB_ID) {
    throw new Error("Notion no está completamente configurado (API key o IDs de bases de datos faltantes)");
  }

  const notion = getClient();

  const facturaPage = await notion.pages.create({
    parent: { database_id: FACTURAS_DB_ID },
    properties: {
      "Proveedor": {
        title: [{ text: { content: invoice.supplier } }],
      },
      "Número de Factura": {
        rich_text: [{ text: { content: invoice.invoiceNumber ?? "" } }],
      },
      "Fecha": invoice.date
        ? { date: { start: invoice.date } }
        : { date: null },
      "Categoría": {
        select: { name: invoice.category },
      },
      "Total": {
        number: invoice.totalAmount ?? 0,
      },
      "Notas": {
        rich_text: [{ text: { content: invoice.notes ?? "" } }],
      },
      "Fecha de registro": {
        date: { start: invoice.createdAt.toISOString().split("T")[0] },
      },
    },
  });

  if (invoice.items.length > 0) {
    await Promise.all(
      invoice.items.map((item) =>
        notion.pages.create({
          parent: { database_id: ITEMS_DB_ID! },
          properties: {
            "Descripción": {
              title: [{ text: { content: item.description } }],
            },
            "Factura": {
              relation: [{ id: facturaPage.id }],
            },
            "Cantidad": {
              number: item.quantity ?? 0,
            },
            "Unidad": {
              rich_text: [{ text: { content: item.unit ?? "" } }],
            },
            "Precio Unitario": {
              number: item.unitPrice ?? 0,
            },
            "Total Ítem": {
              number: item.totalPrice ?? 0,
            },
          },
        })
      )
    );
  }
}
