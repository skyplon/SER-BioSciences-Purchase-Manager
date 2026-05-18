import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp } from "lucide-react";
import { useListInvoices } from "@workspace/api-client-react";
import type { Invoice } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { CATEGORIES } from "@/lib/categories";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/contexts/settings-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 3;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function CalendarPage() {
  const t = useT();
  const { language } = useSettings();
  const locale = language === "es" ? "es-CO" : "en-US";

  const today = new Date();
  const [currentDate, setCurrentDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const lastDay = new Date(year, month + 1, 0).getDate();
  const startDate = toDateStr(year, month, 1);
  const endDate = toDateStr(year, month, lastDay);

  const { data: invoices, isLoading } = useListInvoices({ startDate, endDate });

  const invoicesByDate = useMemo(() => {
    const map: Record<string, Invoice[]> = {};
    for (const inv of invoices ?? []) {
      if (!inv.date) continue;
      const key = inv.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(inv);
    }
    return map;
  }, [invoices]);

  const { calendarDays, weekDayLabels } = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const dayOfWeek = firstDayOfMonth.getDay();
    const offset = (dayOfWeek + 6) % 7;

    const days: (number | null)[] = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= lastDay; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);

    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const labels = [1, 2, 3, 4, 5, 6, 7].map((d) =>
      fmt.format(new Date(2024, 0, d))
    );

    return { calendarDays: days, weekDayLabels: labels };
  }, [year, month, lastDay, locale]);

  const monthLabel = currentDate.toLocaleString(locale, {
    month: "long",
    year: "numeric",
  });

  const totalInvoices = invoices?.length ?? 0;
  const totalSpend =
    invoices?.reduce((s, inv) => s + (inv.totalAmount ?? 0), 0) ?? 0;

  const busiestDay = useMemo(() => {
    let best = { date: "", count: 0 };
    for (const [date, invs] of Object.entries(invoicesByDate)) {
      if (invs.length > best.count) best = { date, count: invs.length };
    }
    return best;
  }, [invoicesByDate]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () =>
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();

  const todayStr = toDateStr(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {t("calendar.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("calendar.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" onClick={goToday}>
              {t("calendar.today")}
            </Button>
          )}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none"
              onClick={prevMonth}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-4 text-sm font-semibold capitalize min-w-[168px] text-center select-none">
              {monthLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none"
              onClick={nextMonth}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border rounded-xl px-5 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div>
              <p className="text-xl font-bold text-foreground">
                {totalInvoices}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("calendar.totalInvoices")}
              </p>
            </div>
          )}
        </div>

        <div className="bg-card border rounded-xl px-5 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-600 font-bold text-base">$</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(totalSpend)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("calendar.totalSpend")}
              </p>
            </div>
          )}
        </div>

        <div className="bg-card border rounded-xl px-5 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-5 w-5 text-amber-500" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : busiestDay.count > 0 ? (
            <div>
              <p className="text-xl font-bold text-foreground">
                {new Date(busiestDay.date + "T12:00:00").toLocaleString(
                  locale,
                  { day: "numeric", month: "short" }
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("calendar.busiestDay")} ({busiestDay.count})
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xl font-bold text-muted-foreground">—</p>
              <p className="text-xs text-muted-foreground">
                {t("calendar.busiestDay")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {weekDayLabels.map((day) => (
            <div
              key={day}
              className="py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const isLastRow = idx >= calendarDays.length - 7;
            const isLastCol = idx % 7 === 6;

            if (day === null) {
              return (
                <div
                  key={`empty-${idx}`}
                  className={cn(
                    "min-h-[90px] sm:min-h-[110px] p-1 bg-muted/10",
                    !isLastCol && "border-r border-border",
                    !isLastRow && "border-b border-border"
                  )}
                />
              );
            }

            const dateStr = toDateStr(year, month, day);
            const dayInvoices = invoicesByDate[dateStr] ?? [];
            const isToday = dateStr === todayStr;
            const visible = dayInvoices.slice(0, MAX_VISIBLE);
            const overflow = dayInvoices.length - MAX_VISIBLE;
            const dayTotal = dayInvoices.reduce(
              (s, i) => s + (i.totalAmount ?? 0),
              0
            );

            return (
              <div
                key={day}
                className={cn(
                  "min-h-[90px] sm:min-h-[110px] p-1.5 flex flex-col gap-0.5 hover:bg-muted/20 transition-colors",
                  !isLastCol && "border-r border-border",
                  !isLastRow && "border-b border-border"
                )}
              >
                {/* Day number + daily total */}
                <div className="flex items-start justify-between mb-0.5">
                  <Link
                    href={`/invoices?startDate=${dateStr}&endDate=${dateStr}`}
                  >
                    <span
                      className={cn(
                        "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors cursor-pointer",
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {day}
                    </span>
                  </Link>
                  {dayInvoices.length > 0 && !isLoading && (
                    <span className="text-[9px] text-muted-foreground font-medium leading-none pt-1.5 hidden sm:block">
                      {formatCurrency(dayTotal)}
                    </span>
                  )}
                </div>

                {/* Invoice pills */}
                {isLoading ? (
                  day % 3 === 0 ? (
                    <Skeleton className="h-3.5 w-full rounded" />
                  ) : null
                ) : (
                  <>
                    {visible.map((inv) => {
                      const color =
                        CATEGORIES[inv.category]?.color ?? "#888888";
                      return (
                        <Link key={inv.id} href={`/invoices/${inv.id}`}>
                          <div
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] leading-snug cursor-pointer hover:opacity-75 transition-opacity w-full"
                            style={{
                              backgroundColor: color + "20",
                              borderLeft: `2px solid ${color}`,
                            }}
                            title={`${inv.supplier} — ${formatCurrency(inv.totalAmount)}`}
                          >
                            <span className="truncate font-medium text-foreground">
                              {inv.supplier}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                    {overflow > 0 && (
                      <Link
                        href={`/invoices?startDate=${dateStr}&endDate=${dateStr}`}
                      >
                        <span className="text-[10px] text-primary hover:underline cursor-pointer pl-1 font-medium">
                          +{overflow} {t("calendar.more")}
                        </span>
                      </Link>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Category legend */}
      {!isLoading && totalInvoices > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(CATEGORIES).map(([name, { color }]) => {
            const count = (invoices ?? []).filter(
              (inv) => inv.category === name
            ).length;
            if (count === 0) return null;
            return (
              <div key={name} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-muted-foreground">
                  {name}
                  <span className="ml-1 font-medium text-foreground">
                    ({count})
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
