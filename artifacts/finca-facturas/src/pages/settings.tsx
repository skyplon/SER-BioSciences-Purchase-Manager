import { useSettings } from "@/contexts/settings-context";
import { useT } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, Globe, Calendar, DollarSign, Trash2, List, Bell, Database } from "lucide-react";
import { cn } from "@/lib/utils";

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

function RowSetting({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const t = useT();
  const {
    theme, setTheme,
    language, setLanguage,
    dateFormat, setDateFormat,
    currency, setCurrency,
    confirmDelete, setConfirmDelete,
    itemsPerPage, setItemsPerPage,
  } = useSettings();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("settings.title")}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t("settings.subtitle")}</p>
      </div>

      {/* Apariencia */}
      <SectionCard title={t("settings.appearance")} icon={Sun}>
        <RowSetting label={t("settings.theme")}>
          <div className="flex gap-2">
            <OptionButton active={theme === "light"} onClick={() => setTheme("light")}>
              <Sun className="h-4 w-4" />
              {t("settings.theme.light")}
            </OptionButton>
            <OptionButton active={theme === "dark"} onClick={() => setTheme("dark")}>
              <Moon className="h-4 w-4" />
              {t("settings.theme.dark")}
            </OptionButton>
          </div>
        </RowSetting>

        <RowSetting label={t("settings.language")}>
          <div className="flex gap-2">
            <OptionButton active={language === "es"} onClick={() => setLanguage("es")}>
              🇨🇴 {t("settings.language.es")}
            </OptionButton>
            <OptionButton active={language === "en"} onClick={() => setLanguage("en")}>
              🇺🇸 {t("settings.language.en")}
            </OptionButton>
          </div>
        </RowSetting>
      </SectionCard>

      {/* Regional */}
      <SectionCard title={t("settings.regional")} icon={Globe}>
        <RowSetting label={t("settings.dateFormat")}>
          <Select value={dateFormat} onValueChange={(v) => setDateFormat(v as "DD/MM/YYYY" | "MM/DD/YYYY")}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DD/MM/YYYY">{t("settings.dateFormat.dmy")}</SelectItem>
              <SelectItem value="MM/DD/YYYY">{t("settings.dateFormat.mdy")}</SelectItem>
            </SelectContent>
          </Select>
        </RowSetting>

        <RowSetting label={t("settings.currency")}>
          <Select value={currency} onValueChange={(v) => setCurrency(v as "COP" | "USD")}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COP">{t("settings.currency.cop")}</SelectItem>
              <SelectItem value="USD">{t("settings.currency.usd")}</SelectItem>
            </SelectContent>
          </Select>
        </RowSetting>
      </SectionCard>

      {/* Comportamiento */}
      <SectionCard title={t("settings.behavior")} icon={List}>
        <RowSetting
          label={t("settings.confirmDelete")}
          description={t("settings.confirmDelete.desc")}
        >
          <Switch checked={confirmDelete} onCheckedChange={setConfirmDelete} />
        </RowSetting>

        <RowSetting
          label={t("settings.itemsPerPage")}
          description={t("settings.itemsPerPage.desc")}
        >
          <Select
            value={String(itemsPerPage)}
            onValueChange={(v) => setItemsPerPage(Number(v))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </RowSetting>
      </SectionCard>

      {/* Ideas próximamente */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t("settings.comingSoon")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              icon: Bell,
              label: t("settings.emailNotifications"),
              desc: t("settings.emailNotificationsDesc"),
            },
            {
              icon: Database,
              label: t("settings.notionSync"),
              desc: t("settings.notionSyncDesc"),
            },
            {
              icon: DollarSign,
              label: t("settings.monthlyBudget"),
              desc: t("settings.monthlyBudgetDesc"),
            },
            {
              icon: Calendar,
              label: t("settings.accountingPeriod"),
              desc: t("settings.accountingPeriodDesc"),
            },
          ].map(({ icon: Icon, label, desc }) => (
            <Card key={label} className="opacity-60">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {t("settings.soon")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
