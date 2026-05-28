import type {
  ClosingReportOccurrence,
  ClosingReportFilters,
  MonthlyChartDatum,
  MonthlyTableRow,
  ProductGroupRow,
} from "./types";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/**
 * Returns the list of months to display in charts and the apuração table.
 * - No date filter → last 12 months
 * - dateFrom only → from that month to current
 * - dateTo only → last 12 months up to that month
 * - Both → range capped at 36 months to avoid rendering too many columns
 */
export function getMonthRange(
  dateFrom: string,
  dateTo: string
): Array<{ month: string; label: string }> {
  const now = new Date();

  let start: Date;
  let end: Date;

  if (dateFrom) {
    const d = new Date(dateFrom + "T12:00:00");
    start = new Date(d.getFullYear(), d.getMonth(), 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  }

  if (dateTo) {
    const d = new Date(dateTo + "T12:00:00");
    end = new Date(d.getFullYear(), d.getMonth(), 1);
  } else {
    end = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Sanity: end must be >= start
  if (end < start) end = new Date(start);

  const result: Array<{ month: string; label: string }> = [];
  const cur = new Date(start);
  let safety = 0;

  while (cur <= end && safety < 36) {
    const m = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    const lbl = `${MONTH_LABELS[cur.getMonth()]}/${String(cur.getFullYear()).slice(2)}`;
    result.push({ month: m, label: lbl });
    cur.setMonth(cur.getMonth() + 1);
    safety++;
  }

  return result;
}

/**
 * Aggregates occurrence totals into monthly chart series.
 * Opened: bucket by occurrence.createdAt month, sum all items totalValue.
 * Closed: bucket by occurrence.completedAt month, same sum.
 */
export function computeMonthlyChartData(
  occurrences: ClosingReportOccurrence[],
  months: Array<{ month: string; label: string }>
): { opened: MonthlyChartDatum[]; closed: MonthlyChartDatum[] } {
  const openedMap = new Map<string, number>();
  const closedMap = new Map<string, number>();

  for (const occ of occurrences) {
    const occValue = occ.items.reduce((s, i) => s + i.totalValue, 0);
    const openedMonth = occ.createdAtIso.substring(0, 7);
    openedMap.set(openedMonth, (openedMap.get(openedMonth) ?? 0) + occValue);

    if (occ.completedAtIso) {
      const closedMonth = occ.completedAtIso.substring(0, 7);
      closedMap.set(closedMonth, (closedMap.get(closedMonth) ?? 0) + occValue);
    }
  }

  const opened: MonthlyChartDatum[] = months.map(({ month, label }) => ({
    month,
    label,
    value: openedMap.get(month) ?? 0,
  }));

  const closed: MonthlyChartDatum[] = months.map(({ month, label }) => ({
    month,
    label,
    value: closedMap.get(month) ?? 0,
  }));

  return { opened, closed };
}

/**
 * Builds the rows for the monthly apuração table (opened + closed values per month).
 * The billing (faturado) value is provided separately as a Record<month, number> and
 * merged in the component so the table can re-render reactively on input changes.
 */
export function computeMonthlyTableRows(
  occurrences: ClosingReportOccurrence[],
  months: Array<{ month: string; label: string }>
): MonthlyTableRow[] {
  const openedMap = new Map<string, number>();
  const closedMap = new Map<string, number>();

  for (const occ of occurrences) {
    const occValue = occ.items.reduce((s, i) => s + i.totalValue, 0);
    const openedMonth = occ.createdAtIso.substring(0, 7);
    openedMap.set(openedMonth, (openedMap.get(openedMonth) ?? 0) + occValue);

    if (occ.completedAtIso) {
      const closedMonth = occ.completedAtIso.substring(0, 7);
      closedMap.set(closedMonth, (closedMap.get(closedMonth) ?? 0) + occValue);
    }
  }

  return months.map(({ month, label }) => ({
    month,
    label,
    openedValue: openedMap.get(month) ?? 0,
    closedValue: closedMap.get(month) ?? 0,
  }));
}

/** Applies all closing report filters to occurrences. */
export function applyClosingFilters(
  occurrences: ClosingReportOccurrence[],
  filters: ClosingReportFilters
): ClosingReportOccurrence[] {
  return occurrences.filter((o) => {
    const createdDate = o.createdAtIso.substring(0, 10);
    if (filters.dateFrom && createdDate < filters.dateFrom) return false;
    if (filters.dateTo && createdDate > filters.dateTo) return false;
    if (filters.statusId && o.statusId !== filters.statusId) return false;
    if (filters.originId && o.originId !== filters.originId) return false;
    if (filters.destinationId && o.destinationId !== filters.destinationId) return false;
    if (filters.userId && o.openedByUserId !== filters.userId) return false;
    if (filters.damageTypeId && !o.items.some((i) => i.damageTypeId === filters.damageTypeId)) return false;
    return true;
  });
}

/**
 * Groups items by product across filtered occurrences.
 * Returns rows sorted descending by totalValue.
 */
export function computeProductGroups(
  occurrences: ClosingReportOccurrence[]
): ProductGroupRow[] {
  const productMap = new Map<
    string,
    {
      productId: string;
      internalCode: string;
      description: string;
      totalQuantity: number;
      totalValue: number;
      occurrenceIds: Set<string>;
    }
  >();

  for (const occ of occurrences) {
    for (const item of occ.items) {
      if (!productMap.has(item.productId)) {
        productMap.set(item.productId, {
          productId: item.productId,
          internalCode: item.productInternalCode,
          description: item.productDescription,
          totalQuantity: 0,
          totalValue: 0,
          occurrenceIds: new Set(),
        });
      }
      const entry = productMap.get(item.productId)!;
      entry.totalQuantity += item.quantity;
      entry.totalValue = Math.round((entry.totalValue + item.totalValue) * 100) / 100;
      entry.occurrenceIds.add(occ.id);
    }
  }

  return [...productMap.values()]
    .map(({ occurrenceIds, ...rest }) => ({
      ...rest,
      occurrenceCount: occurrenceIds.size,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

/** Safe percentage: returns "—" when denominator is zero or falsy. */
export function safePct(numerator: number, denominator: number): string {
  if (!denominator || denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}
