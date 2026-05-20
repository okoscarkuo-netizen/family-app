import {
  initialDashboard,
  type BillReminder,
  type Category,
  type MaintenanceItem,
  type RecentEntry,
  type TodoItem,
} from "@/lib/family-data";

export type DashboardCloudState = {
  categories: Category[];
  todos: TodoItem[];
  bills: BillReminder[];
  maintenance: MaintenanceItem[];
  entries: RecentEntry[];
};

export const initialDashboardCloudState: DashboardCloudState = {
  categories: initialDashboard.categories,
  todos: initialDashboard.todos,
  bills: initialDashboard.bills,
  maintenance: initialDashboard.maintenance,
  entries: initialDashboard.entries,
};

function normalizeArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

export function normalizeDashboardState(value: unknown): DashboardCloudState {
  if (!value || typeof value !== "object") return initialDashboardCloudState;

  const record = value as Partial<Record<keyof DashboardCloudState, unknown>>;

  return {
    categories: normalizeArray(record.categories, initialDashboardCloudState.categories),
    todos: normalizeArray(record.todos, initialDashboardCloudState.todos),
    bills: normalizeArray(record.bills, initialDashboardCloudState.bills),
    maintenance: normalizeArray(record.maintenance, initialDashboardCloudState.maintenance),
    entries: normalizeArray(record.entries, initialDashboardCloudState.entries),
  };
}

export function dashboardStateFingerprint(state: DashboardCloudState) {
  return JSON.stringify(state);
}
