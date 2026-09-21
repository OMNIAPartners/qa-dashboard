export const DEFAULT_CONFIG: Record<string, unknown>;
export function buildDashboard(db: unknown, filters?: unknown): any;
export function computeTotalAutomated(uiAutomated: number, apiAutomated: number, countingMode: string): number;
export function resolveAutomationTotals(input: {
  uiAutomated: number;
  apiAutomated: number;
  inSprintAutomated: number;
  backlogAutomated: number;
  manualWritten: number;
  testCasesExecuted: number;
  baselineTotalTestCases: number;
  countingMode: string;
}): { totalAutomated: number; totalTestCases: number; remaining: number; coverage: number };
export function moduleSnapshot(mod: unknown, allUpdates: unknown[], config: unknown): any;
export function weeklyStatus(updates: unknown[], weekStart: string): unknown;
export function bimonthly(modules: unknown[], updates: unknown[], startDate: string, endDate: string, config: unknown): unknown;
