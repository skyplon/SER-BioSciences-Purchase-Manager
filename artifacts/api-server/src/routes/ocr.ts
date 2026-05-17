import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ExtractInvoiceDataBody, ValidateInvoiceDataBody } from "@workspace/api-zod";

const router: IRouter = Router();

const ITEM_JSON = `{
      "name": "nombre estandarizado corto del artículo (ej: 'Jeringa Desechable 5ml', 'Cemento Gris 50kg', 'Ivermectina 1%')",
      "description": "descripción completa tal como aparece en la factura",
      "quantity": número o null,
      "unit": "unidad de medida (unidad, litro, kg, m, etc.) o null",
      "unitPrice": precio unitario como número o null,
      "totalPrice": precio total del item como número o null
    }`;

const BASE_SYSTEM = `Eres un asistente especializado en extraer información de facturas comerciales latinoamericanas de fincas.

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta (sin texto adicional):
{
  "invoiceNumber": "número de factura o null",
  "supplier": "nombre del proveedor/tienda en Title Case",
  "date": "fecha en formato YYYY-MM-DD o null si no está clara",
  "category": "una de: Alimentación animal, Construcción, Consumibles del Laboratorio, Energía, Gasolina, Limpieza, Salud Animal, Transporte, Otros",
  "totalAmount": número total de la factura o null,
  "description": "descripción corta (máximo 2 oraciones) explicando la naturaleza de la compra: qué tipo de proveedor es, qué tipo de artículos se compraron y para qué sirven en el contexto de una finca.",
  "notes": "texto con viñetas • cubriendo toda la información complementaria de la factura",
  "items": [
    ${ITEM_JSON}
  ]
}

Reglas importantes:
- supplier: nombre en Title Case, sin abreviaciones (ej: 'La Parcela Agro-Market', 'Ferretería El Constructor').
- category: usa "Alimentación animal" para concentrados, forrajes y suplementos para animales; "Construcción" para materiales de ferretería y obra; "Consumibles del Laboratorio" para reactivos, insumos de laboratorio y análisis; "Energía" para electricidad, gas o energéticos distintos a gasolina; "Gasolina" para gasolina, ACPM o diesel; "Limpieza" para detergentes, desinfectantes y aseo; "Salud Animal" para medicamentos, vacunas y productos veterinarios; "Transporte" para fletes, servicios de carga y transporte; "Otros" para cualquier otra cosa.
- Para los precios, extrae solo el número (sin símbolos de moneda ni puntos de miles), en punto decimal.
- Si no puedes leer claramente un campo, usa null.
- items debe tener todos los productos/servicios listados en la factura.
- name de cada item: nombre genérico estandarizado en Title Case que permita identificar el mismo producto entre facturas distintas (ej: 'Jeringa Desechable 5ml', 'Concentrado Novillo Engorde', 'Cemento Gris 50kg'). Evita incluir marcas si hay nombre genérico disponible.

INSTRUCCIONES PARA EL CAMPO "notes":
El campo notes es crítico para la trazabilidad. Debes extraer TODA la información complementaria visible en la factura usando viñetas (•). Incluye SIEMPRE cada uno de los siguientes datos si aparecen en el documento:
• Forma de pago y medio de pago
• Nombre del vendedor o asesor comercial
• NIT o CC del proveedor
• Dirección completa del proveedor
• Teléfono del proveedor
• Número de remisión o guía de despacho
• Número de orden de compra (OC)
• Lotes y fechas de vencimiento de productos
• Descuentos aplicados o recargos especiales
• Resolución DIAN (número y fecha de expedición)
• CUFE o CUDE completo (cópialo tal cual aparece)
• Autorización de numeración: número de autorización, rango de facturas (ej. CR200001 a CR400000) y vigencia
• Firma digital (copia los primeros 60 caracteres seguido de "...")
• Fecha DIAN
• Régimen tributario del proveedor (autorretenedor ICA, no grandes contribuyentes, responsable de IVA, etc.)
• Leyendas o avisos impresos en la factura
• Condiciones especiales de entrega o garantías
Sé exhaustivo. Usa null SOLO si la factura no tiene absolutamente ninguna información adicional.`;

router.post("/ocr/extract", async (req, res): Promise<void> => {
  const parsed = ExtractInvoiceDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { imageBase64 } = parsed.data;

  const imageContent = { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" as const } };

  const mainResponse = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: BASE_SYSTEM },
      {
        role: "user",
        content: [
          imageContent,
          { type: "text", text: "Extrae toda la información de esta factura y devuelve solo el JSON. Para el campo 'notes' es OBLIGATORIO incluir con viñetas • todo dato complementario visible: NIT y contacto del proveedor, vendedor, forma y medio de pago, remisión, resolución DIAN, CUFE completo, autorización de numeración con rango y vigencia, régimen tributario, y cualquier leyenda impresa. No omitas nada." },
        ],
      },
    ],
  });

  const content = mainResponse.choices[0]?.message?.content ?? "{}";
  let extracted: Record<string, unknown>;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    extracted = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    extracted = { invoiceNumber: null, supplier: null, date: null, category: null, totalAmount: null, notes: null, items: [] };
  }

  const mainNotes = typeof extracted.notes === "string" ? extracted.notes : null;

  // Second focused call to enrich notes — only overwrites if it returns more content
  const notesResponse = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 2048,
    messages: [
      {
        role: "system",
        content: "Eres un extractor de datos complementarios de facturas. Lee la imagen y transcribe con viñetas (•) TODOS los datos que NO sean artículos/ítems del pedido: NIT del proveedor, dirección, teléfono, vendedor, forma de pago, medio de pago, remisión, OC, lotes, vencimientos, descuentos, resolución DIAN con número y fecha, CUFE o CUDE completo, autorización de numeración (número, rango, vigencia), firma digital (primeros 60 caracteres + ...), fecha DIAN, régimen tributario (autorretenedor ICA, IVA, grandes contribuyentes, etc.), leyendas impresas. Responde ÚNICAMENTE con las viñetas, sin texto adicional.",
      },
      {
        role: "user",
        content: [imageContent, { type: "text", text: "Transcribe con viñetas • todos los datos complementarios visibles en esta factura." }],
      },
    ],
  });

  const notesText = notesResponse.choices[0]?.message?.content?.trim() ?? null;
  req.log.info({ mainNotesLen: mainNotes?.length ?? 0, notesTextLen: notesText?.length ?? 0 }, "notes comparison");

  if (notesText && (!mainNotes || notesText.length > mainNotes.length)) {
    extracted.notes = notesText;
  }

  res.json(extracted);
});

router.post("/ocr/validate", async (req, res): Promise<void> => {
  const parsed = ValidateInvoiceDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;

  const validatePrompt = `Eres un asistente de control de calidad para datos de facturas de una finca colombiana.

Se te proporcionan los datos de una factura extraídos de una imagen. Tu tarea es:
1. Corregir la ortografía de todos los campos de texto.
2. Estandarizar el nombre del proveedor en Title Case.
3. Verificar que la categoría sea la más apropiada.
4. Para cada artículo: generar/corregir el "name" (nombre genérico estandarizado en Title Case) y corregir la ortografía de "description".
5. Asegurarte de que las unidades estén estandarizadas (unidad, litro, kg, m, etc.).
6. No modificar valores numéricos ni fechas.
7. Enriquecer el campo "notes": si está vacío o es escueto, complementa con observaciones útiles inferidas del contexto (tipo de proveedor, uso probable de los artículos en una finca, condiciones típicas de compra, recomendaciones de almacenamiento o manejo si aplica). Usa viñetas '•' para cada punto y organiza la información de forma clara y estructurada. El campo notes debe ser siempre detallado y aportar valor real al registro de la compra.

Devuelve ÚNICAMENTE el JSON corregido con la misma estructura exacta (sin texto adicional):
{
  "invoiceNumber": string o null,
  "supplier": string (Title Case) o null,
  "date": string YYYY-MM-DD o null,
  "category": "una de: Alimentación animal, Construcción, Consumibles del Laboratorio, Energía, Gasolina, Limpieza, Salud Animal, Transporte, Otros",
  "totalAmount": número o null,
  "description": string o null,
  "notes": string o null,
  "items": [
    ${ITEM_JSON}
  ]
}

Datos a validar:
${JSON.stringify(data, null, 2)}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [{ role: "user", content: validatePrompt }],
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  let validated: Record<string, unknown>;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    validated = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    validated = data as unknown as Record<string, unknown>;
  }

  res.json(validated);
});

router.post("/ocr/extract-text", async (req, res): Promise<void> => {
  const { text } = req.body as { text?: unknown };
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text field is required" });
    return;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: BASE_SYSTEM },
      {
        role: "user",
        content: `Extrae toda la información de esta factura y devuelve solo el JSON.\n\nTexto de la factura:\n${text}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  let extracted: Record<string, unknown>;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    extracted = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    extracted = { invoiceNumber: null, supplier: null, date: null, category: null, totalAmount: null, notes: null, items: [] };
  }

  res.json(extracted);
});

export default router;
