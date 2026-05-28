import type {
  DashboardOccurrence,
  DashboardParam,
  DashboardMetrics,
  DashboardFilters,
  MonthDamageCount,
  MonthDamageValue,
  DamageQty,
  DamageValue,
} from "./types";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getLast12Months(): Array<{ month: string; label: string }> {
  const result = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MONTH_LABELS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
    result.push({ month, label });
  }
  return result;
}

export function applyFilters(occurrences: DashboardOccurrence[], filters: DashboardFilters): DashboardOccurrence[] {
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

export function computeMetrics(
  occurrences: DashboardOccurrence[],
  statuses: DashboardParam[]
): DashboardMetrics {
  const minOrder = statuses.length > 0 ? Math.min(...statuses.map((s) => s.order ?? 0)) : 1;

  const closedOccurrences = occurrences.filter((o) => o.statusIsFinal).length;
  const openOccurrences = occurrences.filter((o) => !o.statusIsFinal && o.statusFunnelOrder === minOrder).length;
  const inProgressOccurrences = occurrences.length - openOccurrences - closedOccurrences;

  const allItems = occurrences.flatMap((o) => o.items);
  const totalItems = allItems.length;
  const totalQuantity = allItems.reduce((s, i) => s + i.quantity, 0);
  const registeredValue = allItems.reduce((s, i) => s + i.totalValue, 0);
  const zeroValueItems = allItems.filter((i) => i.unitValue <= 0.01).length;
  const zeroValuePercent = totalItems > 0 ? (zeroValueItems / totalItems) * 100 : 0;
  const uniqueProductsWithoutPrice = new Set(
    allItems.filter((i) => i.unitValue <= 0.01).map((i) => i.productId)
  ).size;

  const stuckThresholdDays = 7;
  const now = Date.now();
  const stuckOccurrences = occurrences.filter((o) => {
    if (o.statusIsFinal || o.statusFunnelOrder !== minOrder) return false;
    return (now - new Date(o.createdAtIso).getTime()) / (1000 * 60 * 60 * 24) > stuckThresholdDays;
  }).length;

  // Tempo médio em ciclo: inclui todas as ocorrências com data de abertura válida.
  // Ocorrências concluídas usam completedAt; abertas usam a data atual.
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const validCycleOccurrences = occurrences.filter((o) => {
    const t = new Date(o.createdAtIso).getTime();
    return !isNaN(t);
  });
  let avgCycleDays = 0;
  if (validCycleOccurrences.length > 0) {
    const totalMs = validCycleOccurrences.reduce((s, o) => {
      const openedMs = new Date(o.createdAtIso).getTime();
      const baseMs = o.completedAtIso !== null ? new Date(o.completedAtIso).getTime() : now;
      return s + Math.max(0, baseMs - openedMs);
    }, 0);
    avgCycleDays = totalMs / validCycleOccurrences.length / MS_PER_DAY;
  }

  // --- Categorical aggregations ---

  const statusMap = new Map<string, { id: string; name: string; order: number; isFinal: boolean; count: number }>();
  for (const s of statuses) {
    statusMap.set(s.id, { id: s.id, name: s.name, order: s.order ?? 0, isFinal: s.isFinal ?? false, count: 0 });
  }
  for (const o of occurrences) {
    if (statusMap.has(o.statusId)) statusMap.get(o.statusId)!.count++;
    else statusMap.set(o.statusId, { id: o.statusId, name: o.statusName, order: o.statusFunnelOrder, isFinal: o.statusIsFinal, count: 1 });
  }
  const byStatus = [...statusMap.values()].sort((a, b) => a.order - b.order);

  const originMap = new Map<string, { id: string; name: string; count: number }>();
  for (const o of occurrences) {
    if (!originMap.has(o.originId)) originMap.set(o.originId, { id: o.originId, name: o.originName, count: 0 });
    originMap.get(o.originId)!.count++;
  }
  const byOrigin = [...originMap.values()].sort((a, b) => b.count - a.count);

  const dtMap = new Map<string, { id: string; name: string; count: number }>();
  for (const item of allItems) {
    if (!dtMap.has(item.damageTypeId)) dtMap.set(item.damageTypeId, { id: item.damageTypeId, name: item.damageTypeName, count: 0 });
    dtMap.get(item.damageTypeId)!.count++;
  }
  const byDamageType = [...dtMap.values()].sort((a, b) => b.count - a.count);

  const damageUniverse = [...dtMap.values()]
    .sort((a, b) => b.count - a.count)
    .map((d) => ({ id: d.id, name: d.name }));

  const destMap = new Map<string, { id: string; name: string; count: number }>();
  for (const o of occurrences) {
    if (o.destinationId && o.destinationName) {
      if (!destMap.has(o.destinationId)) destMap.set(o.destinationId, { id: o.destinationId, name: o.destinationName, count: 0 });
      destMap.get(o.destinationId)!.count++;
    }
  }
  const byDestination = [...destMap.values()].sort((a, b) => b.count - a.count);

  const userMap = new Map<string, { id: string; name: string; role: string; count: number }>();
  for (const o of occurrences) {
    if (!userMap.has(o.openedByUserId)) userMap.set(o.openedByUserId, { id: o.openedByUserId, name: o.openedByName, role: o.openedByRole, count: 0 });
    userMap.get(o.openedByUserId)!.count++;
  }
  const byUserOpened = [...userMap.values()].sort((a, b) => b.count - a.count);

  // --- Monthly stacked-by-damage aggregations (4 series) ---

  const months = getLast12Months();

  // We bucket items by either openedMonth or closedMonth and aggregate by damageTypeId.
  const openedItemsMap = new Map<string, Map<string, number>>(); // month -> dt -> count
  const closedItemsMap = new Map<string, Map<string, number>>();
  const openedValueMap = new Map<string, Map<string, number>>(); // month -> dt -> R$
  const closedValueMap = new Map<string, Map<string, number>>();

  function bumpCount(map: Map<string, Map<string, number>>, month: string, dt: string, by: number) {
    if (!map.has(month)) map.set(month, new Map());
    const m = map.get(month)!;
    m.set(dt, (m.get(dt) ?? 0) + by);
  }

  for (const o of occurrences) {
    const openedMonth = o.createdAtIso.substring(0, 7);
    const closedMonth = o.completedAtIso ? o.completedAtIso.substring(0, 7) : null;

    for (const it of o.items) {
      // Count of items (lines) per damage type
      bumpCount(openedItemsMap, openedMonth, it.damageTypeId, 1);
      bumpCount(openedValueMap, openedMonth, it.damageTypeId, it.totalValue);

      if (closedMonth) {
        bumpCount(closedItemsMap, closedMonth, it.damageTypeId, 1);
        bumpCount(closedValueMap, closedMonth, it.damageTypeId, it.totalValue);
      }
    }
  }

  function buildMonthlyCount(
    map: Map<string, Map<string, number>>
  ): MonthDamageCount[] {
    return months.map(({ month, label }) => {
      const m = map.get(month) ?? new Map<string, number>();
      const damages: DamageQty[] = damageUniverse.map((d) => ({
        damageTypeId: d.id,
        damageTypeName: d.name,
        quantity: m.get(d.id) ?? 0,
      }));
      const total = damages.reduce((acc, d) => acc + d.quantity, 0);
      return { month, label, total, damages };
    });
  }

  function buildMonthlyValue(
    map: Map<string, Map<string, number>>
  ): MonthDamageValue[] {
    return months.map(({ month, label }) => {
      const m = map.get(month) ?? new Map<string, number>();
      const damages: DamageValue[] = damageUniverse.map((d) => ({
        damageTypeId: d.id,
        damageTypeName: d.name,
        value: m.get(d.id) ?? 0,
      }));
      const total = damages.reduce((acc, d) => acc + d.value, 0);
      return { month, label, total, damages };
    });
  }

  const monthlyOpenedItemsByDamage = buildMonthlyCount(openedItemsMap);
  const monthlyClosedItemsByDamage = buildMonthlyCount(closedItemsMap);
  const monthlyOpenedValueByDamage = buildMonthlyValue(openedValueMap);
  const monthlyClosedValueByDamage = buildMonthlyValue(closedValueMap);

  return {
    totalOccurrences: occurrences.length,
    openOccurrences,
    inProgressOccurrences,
    closedOccurrences,
    totalItems,
    totalQuantity,
    registeredValue,
    zeroValueItems,
    zeroValuePercent,
    uniqueProductsWithoutPrice,
    stuckOccurrences,
    avgCycleDays,
    byStatus,
    byOrigin,
    byDamageType,
    byDestination,
    byUserOpened,
    damageUniverse,
    monthlyOpenedItemsByDamage,
    monthlyClosedItemsByDamage,
    monthlyOpenedValueByDamage,
    monthlyClosedValueByDamage,
  };
}
