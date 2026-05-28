import type { DashboardFilters, DashboardParam } from "@/lib/dashboard/types";
export type { DashboardFilters as ClosingReportFilters, DashboardParam as ClosingReportParam };
export { EMPTY_FILTERS as EMPTY_CLOSING_FILTERS } from "@/lib/dashboard/types";

export interface ClosingReportItem {
  id: string;
  productId: string;
  productInternalCode: string;
  productDescription: string;
  damageTypeId: string;
  quantity: number;
  totalValue: number;
}

export interface ClosingReportOccurrence {
  id: string;
  occurrenceCode: string;
  createdAtIso: string;
  completedAtIso: string | null;
  /** updatedAt ISO — used as fallback bucket date for finalized occurrences missing completedAt. */
  updatedAtIso: string;
  statusId: string;
  statusIsFinal: boolean;
  originId: string;
  destinationId: string | null;
  openedByUserId: string;
  items: ClosingReportItem[];
}

/**
 * Monthly data for a specific year, used by both line charts and the transposed
 * apuração table. One entry per calendar month (12 total).
 */
export interface YearlyMonthData {
  /** "YYYY-MM" */
  month: string;
  /** Short month label: "Jan", "Fev", etc. */
  label: string;
  openedValue: number;
  closedValue: number;
}

export interface ProductGroupRow {
  productId: string;
  internalCode: string;
  description: string;
  totalQuantity: number;
  totalValue: number;
  /** Sum of totalValue for items belonging to occurrences where statusIsFinal = true. */
  finalizedValue: number;
  occurrenceCount: number;
}
