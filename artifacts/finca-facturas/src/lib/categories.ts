export const CATEGORIES: Record<string, { color: string; label: string }> = {
  "Alimentación animal": { color: "#15803d", label: "Alimentación animal" },
  "Construcción":        { color: "#92400e", label: "Construcción" },
  "Consumibles del Laboratorio": { color: "#7c3aed", label: "Consumibles del Laboratorio" },
  "Energía":             { color: "#d97706", label: "Energía" },
  "Gasolina":            { color: "#dc2626", label: "Gasolina" },
  "Limpieza":            { color: "#0891b2", label: "Limpieza" },
  "Salud Animal":        { color: "#2563a8", label: "Salud Animal" },
  "Transporte":          { color: "#0f766e", label: "Transporte" },
  "Otros":               { color: "#6b7280", label: "Otros" },
};

export const CATEGORY_OPTIONS = Object.keys(CATEGORIES);
