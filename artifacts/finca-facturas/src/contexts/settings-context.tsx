import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";
export type Language = "es" | "en";
export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY";
export type Currency = "COP" | "USD";

interface Settings {
  theme: Theme;
  language: Language;
  dateFormat: DateFormat;
  currency: Currency;
  confirmDelete: boolean;
  itemsPerPage: number;
}

interface SettingsContextValue extends Settings {
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setDateFormat: (format: DateFormat) => void;
  setCurrency: (currency: Currency) => void;
  setConfirmDelete: (value: boolean) => void;
  setItemsPerPage: (value: number) => void;
}

const defaultSettings: Settings = {
  theme: "light",
  language: "es",
  dateFormat: "DD/MM/YYYY",
  currency: "COP",
  confirmDelete: true,
  itemsPerPage: 25,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem("finca-settings");
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {}
  return defaultSettings;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    localStorage.setItem("finca-settings", JSON.stringify(settings));
    const root = document.documentElement;
    if (settings.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [settings]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  return (
    <SettingsContext.Provider
      value={{
        ...settings,
        setTheme: (v) => update("theme", v),
        setLanguage: (v) => update("language", v),
        setDateFormat: (v) => update("dateFormat", v),
        setCurrency: (v) => update("currency", v),
        setConfirmDelete: (v) => update("confirmDelete", v),
        setItemsPerPage: (v) => update("itemsPerPage", v),
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
