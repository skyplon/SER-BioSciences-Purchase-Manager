export const CATEGORIES: Record<string, { color: string; label: string }> = {
  "Ferretería": { color: "#7c5c3e", label: "Ferretería" },
  "Agro": { color: "#3b7d3b", label: "Agro" },
  "Veterinaria": { color: "#2563a8", label: "Veterinaria" },
  "Combustible": { color: "#c2410c", label: "Combustible" },
  "Otros": { color: "#6b7280", label: "Otros" },
};

export const CATEGORY_OPTIONS = Object.keys(CATEGORIES);
