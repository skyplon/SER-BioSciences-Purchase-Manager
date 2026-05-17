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
  description: string | null;
  notes: string | null;
  buyer: string | null;
  createdAt: Date;
  imageUrl: string | null;
  items: NotionInvoiceItem[];
}

export async function syncInvoiceToNotion(invoice: NotionInvoice): Promise<void> {
  if (!NOTION_API_KEY || !FACTURAS_DB_ID || !ITEMS_DB_ID) {
    throw new Error("Notion no está completamente configurado (API key o IDs de bases de datos faltantes)");
  }

  const notion = getClient();

  const pagePayload: Parameters<typeof notion.pages.create>[0] = {
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
      "Descripción": {
        rich_text: [{ text: { content: invoice.description ?? "" } }],
      },
      "Notas": {
        rich_text: [{ text: { content: invoice.notes ?? "" } }],
      },
      ...(invoice.buyer
        ? { "Comprador": { select: { name: invoice.buyer } } }
        : {}),
      ...(invoice.imageUrl
        ? {
            "Foto del Recibo": {
              files: [
                {
                  type: "external",
                  name: `factura-${invoice.id}.jpg`,
                  external: { url: invoice.imageUrl },
                },
              ],
            },
          }
        : {}),
    },
  };

  if (invoice.imageUrl) {
    (pagePayload as Record<string, unknown>).cover = {
      type: "external",
      external: { url: invoice.imageUrl },
    };
    (pagePayload as Record<string, unknown>).children = [
      {
        object: "block",
        type: "image",
        image: {
          type: "external",
          external: { url: invoice.imageUrl },
        },
      },
    ];
  }

  const facturaPage = await notion.pages.create(pagePayload);

  if (invoice.items.length > 0) {
    await Promise.all(
      invoice.items.map((item) =>
        notion.pages.create({
          parent: { database_id: ITEMS_DB_ID! },
          properties: {
            "Artículos": {
              title: [{ text: { content: item.description } }],
            },
            "Proveedor": {
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
