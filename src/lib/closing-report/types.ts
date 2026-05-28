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
  statusId: string;
  statusIsFinal: boolean;
  originId: string;
  destinationId: string | null;
  openedByUserId: string;
  items: ClosingReportItem[];
}

export interface MonthlyChartDatum {
  month: string;
  label: string;
  value: number;
}

export interface MonthlyTableRow {
  month: string;
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
  occurrenceCount: number;
}
