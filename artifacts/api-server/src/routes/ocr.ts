import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ExtractInvoiceDataBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/ocr/extract", async (req, res): Promise<void> => {
  const parsed = ExtractInvoiceDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { imageBase64 } = parsed.data;

  const systemPrompt = `Eres un asistente especializado en extraer información de facturas comerciales latinoamericanas.
Analiza la imagen de la factura y extrae TODOS los datos disponibles con precisión.

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta (sin texto adicional):
{
  "invoiceNumber": "número de factura o null",
  "supplier": "nombre del proveedor/tienda",
  "date": "fecha en formato YYYY-MM-DD o null si no está clara",
  "category": "una de: Ferretería, Agro, Veterinaria, Combustible, Otros",
  "totalAmount": número total de la factura o null,
  "notes": "observaciones adicionales relevantes o null",
  "items": [
    {
      "description": "descripción del artículo",
      "quantity": número o null,
      "unit": "unidad de medida (unidad, litro, kg, m, etc.) o null",
      "unitPrice": precio unitario como número o null,
      "totalPrice": precio total del item como número o null
    }
  ]
}

Reglas importantes:
- category: usa "Ferretería" para ferreterías y materiales de construcción, "Agro" para insumos agrícolas, abonos, semillas, fumigantes, "Veterinaria" para productos veterinarios y medicamentos animales, "Combustible" para gasolina/ACPM/diesel, "Otros" para cualquier otra cosa.
- Para los precios, extrae solo el número (sin símbolos de moneda ni puntos de miles), en punto decimal.
- Si no puedes leer claramente un campo, usa null.
- items debe tener todos los productos/servicios listados en la factura.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 4096,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "high",
            },
          },
          {
            type: "text",
            text: "Extrae toda la información de esta factura y devuelve solo el JSON.",
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  let extracted: Record<string, unknown>;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    extracted = JSON.parse(jsonStr);
  } catch {
    extracted = {
      invoiceNumber: null,
      supplier: null,
      date: null,
      category: null,
      totalAmount: null,
      notes: null,
      items: [],
    };
  }

  res.json(extracted);
});

export default router;
