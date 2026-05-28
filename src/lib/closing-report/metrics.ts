import type {
  ClosingReportOccurrence,
  ClosingReportFilters,
  YearlyMonthData,
  ProductGroupRow,
} from "./types";

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/** Returns the 12 fixed months for a given year. */
export function getYearMonths(year: number): Array<{ month: string; label: string }> {
  return MONTH_LABELS.map((label, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`,
    label,
  }));
}

/**
 * Returns a sorted (descending) list of years present in the occurrence data.
 * Always includes the current calendar year.
 */
export function getAvailableYears(occurrences: ClosingReportOccurrence[]): number[] {
  const years = new Set<number>();
  years.add(new Date().getFullYear());
  for (const occ of occurrences) {
    years.add(Number(occ.createdAtIso.substring(0, 4)));
    if (occ.completedAtIso) years.add(Number(occ.completedAtIso.substring(0, 4)));
    years.add(Number(occ.updatedAtIso.substring(0, 4)));
  }
  return [...years].sort((a, b) => b - a);
}

/**
 * Computes opened and finalized monetary values for every month in the given year.
 *
 * "Opened" = occurrence created in that month (by createdAt).
 *
 * "Finalized" = occurrence where statusIsFinal === true.
 *   Temporal bucket uses:
 *   1. completedAt if it is set — the authoritative completion timestamp.
 *   2. updatedAt as fallback — best available estimate when completedAt was not
 *      recorded at the time the status was set to final (data-entry gap).
 *
 * Rationale: the pipeline column view groups occurrences by status (isFinal=true),
 * regardless of completedAt. Aligning the report to that same concept ensures
 * consistency with the operational view and prevents silent under-counting of
 * occurrences that were effectively closed but never had completedAt written.
 */
export function computeYearlyData(
  occurrences: ClosingReportOccurrence[],
  year: number
): YearlyMonthData[] {
  const months = getYearMonths(year);
  const openedMap = new Map<string, number>();
  const closedMap = new Map<string, number>();

  for (const occ of occurrences) {
    const occValue = occ.items.reduce((s, i) => s + i.totalValue, 0);

    const openedMonth = occ.createdAtIso.substring(0, 7);
    openedMap.set(openedMonth, (openedMap.get(openedMonth) ?? 0) + occValue);

    if (occ.statusIsFinal) {
      const finalMonth = (occ.completedAtIso ?? occ.updatedAtIso).substring(0, 7);
      closedMap.set(finalMonth, (closedMap.get(finalMonth) ?? 0) + occValue);
    }
  }

  return months.map(({ month, label }) => ({
    month,
    label,
    openedValue: openedMap.get(month) ?? 0,
    closedValue: closedMap.get(month) ?? 0,
  }));
}

/** Applies all closing-report detail filters to occurrences (items section only). */
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
 * Groups items by product across the filtered occurrences.
 * Sorted descending by totalValue.
 *
 * finalizedValue = sum of item.totalValue for items belonging to occurrences
 * where statusIsFinal === true within the current filter set.
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
      finalizedValue: number;
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
          finalizedValue: 0,
          occurrenceIds: new Set(),
        });
      }
      const entry = productMap.get(item.productId)!;
      entry.totalQuantity += item.quantity;
      entry.totalValue = Math.round((entry.totalValue + item.totalValue) * 100) / 100;
      if (occ.statusIsFinal) {
        entry.finalizedValue = Math.round((entry.finalizedValue + item.totalValue) * 100) / 100;
      }
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

/** Safe percentage — returns "—" when denominator is zero or falsy. */
export function safePct(numerator: number, denominator: number): string {
  if (!denominator || denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}
