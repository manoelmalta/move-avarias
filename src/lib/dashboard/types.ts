export interface DashboardItem {
  id: string;
  productId: string;
  productDescription: string;
  damageTypeId: string;
  damageTypeName: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
}

export interface DashboardOccurrence {
  id: string;
  occurrenceCode: string;
  createdAtIso: string;
  completedAtIso: string | null;
  statusId: string;
  statusName: string;
  statusIsFinal: boolean;
  statusFunnelOrder: number;
  originId: string;
  originName: string;
  destinationId: string | null;
  destinationName: string | null;
  openedByUserId: string;
  openedByName: string;
  openedByRole: string;
  items: DashboardItem[];
}

export interface DashboardParam {
  id: string;
  name: string;
  order?: number;
  isFinal?: boolean;
}

export interface DashboardFilters {
  dateFrom: string;
  dateTo: string;
  statusId: string;
  originId: string;
  damageTypeId: string;
  destinationId: string;
  userId: string;
}

export const EMPTY_FILTERS: DashboardFilters = {
  dateFrom: "",
  dateTo: "",
  statusId: "",
  originId: "",
  damageTypeId: "",
  destinationId: "",
  userId: "",
};

export interface ByKey {
  id: string;
  name: string;
  count: number;
}

// ---------- Monthly stacked-by-damage shapes (4 charts) ----------

/** Per-damage-type item count in a month bucket. */
export interface DamageQty {
  damageTypeId: string;
  damageTypeName: string;
  quantity: number;
}

/** Per-damage-type monetary value in a month bucket. */
export interface DamageValue {
  damageTypeId: string;
  damageTypeName: string;
  value: number;
}

export interface MonthDamageCount {
  month: string;
  label: string;
  total: number; // total items in month
  damages: DamageQty[];
}

export interface MonthDamageValue {
  month: string;
  label: string;
  total: number; // total value in month
  damages: DamageValue[];
}

// ---------- Aggregate DashboardMetrics ----------

export interface DashboardMetrics {
  totalOccurrences: number;
  openOccurrences: number;
  inProgressOccurrences: number;
  closedOccurrences: number;
  totalItems: number;
  totalQuantity: number;
  registeredValue: number;
  zeroValueItems: number;
  zeroValuePercent: number;
  uniqueProductsWithoutPrice: number;
  stuckOccurrences: number;
  /** Average days from open to close (closed) or to today (open). Always ≥ 0; 0 when no valid occurrences. */
  avgCycleDays: number;
  byStatus: Array<ByKey & { order: number; isFinal: boolean }>;
  byOrigin: ByKey[];
  byDamageType: ByKey[];
  byDestination: ByKey[];
  byUserOpened: Array<ByKey & { role: string }>;
  /** All damage types present in the dataset, ordered by total items desc. */
  damageUniverse: Array<{ id: string; name: string }>;
  /** Quantity of items opened in each month, stacked by damage type (bucket: createdAt). */
  monthlyOpenedItemsByDamage: MonthDamageCount[];
  /** Quantity of items in occurrences encerradas in each month (bucket: completedAt). */
  monthlyClosedItemsByDamage: MonthDamageCount[];
  /** Sum totalValue of items opened in each month, stacked by damage type (bucket: createdAt). */
  monthlyOpenedValueByDamage: MonthDamageValue[];
  /** Sum totalValue of items in occurrences encerradas in each month (bucket: completedAt). */
  monthlyClosedValueByDamage: MonthDamageValue[];
}
