export type Role = "qa" | "lead" | "admin";
export type ProjectName = "Connect" | "Force";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface Module {
  id: string;
  name: string;
  project?: ProjectName;
  isFeeShare?: boolean;
  totalTestCases: number;
  manualWritten: number;
  uiAutomated: number;
  apiRecorded: number;
  apiAutomated: number;
  baselineLocked?: boolean;
  current?: ModuleCurrent;
}

export interface StatusTone {
  label: string;
  tone: "green" | "amber" | "orange" | "red";
}

export interface ModuleCurrent {
  totalTestCases: number;
  manualWritten: number;
  uiAutomated: number;
  apiAutomated: number;
  apiRecorded: number;
  inSprintAutomated: number;
  backlogAutomated: number;
  totalAutomated: number;
  remaining: number;
  coverage: number;
  automationPct?: string;
  testCasesExecuted?: number;
  passed?: number;
  failed?: number;
  blocked?: number;
  defectsRaised?: number;
  defectsClosed?: number;
  status: StatusTone;
}

export interface Sprint {
  id: string;
  sprintName: string;
  project?: ProjectName;
  startDate: string;
  endDate: string;
  plannedTestCases: number;
  inSprintAutoExecuted?: number;
  inSprintAutoPassed?: number;
  inSprintAutoFailed?: number;
  inSprintAutoBlocked?: number;
  inSprintExecutionNotes?: string;
  inSprintExecutionRecordedAt?: string;
  inSprintExecutionPassPct?: number;
  sprintClosed?: boolean;
  inSprintAutomated?: number;
  backlogAutomated?: number;
  uiAutomated?: number;
  apiAutomated?: number;
  totalAutomated?: number;
  manualWritten?: number;
  testCasesExecuted?: number;
  defectsRaised?: number;
  defectsClosed?: number;
  passed?: number;
  failed?: number;
  blocked?: number;
  remaining?: number;
  completion?: number;
  manualPct?: number;
  executionPct?: number;
  status?: StatusTone;
}

export interface AppConfig {
  countingMode: "unique_test_cases" | "separate_assets" | "unique_max";
  allowAutomationExceedScope: boolean;
  allowApiExceedRecorded: boolean;
  thresholds: { green: number; amber: number; orange: number };
  currentSprintId: string;
  clientFocus: string;
  clientRisks: string;
  clientAchievements: string;
  weeklyHighlights?: Record<ProjectName, { thisWeek: string; nextWeek: string; attention: string }>;
}

export interface DailyUpdate {
  id: string;
  date: string;
  project?: ProjectName;
  userId: string;
  moduleId: string;
  sprintId: string;
  userStory: string;
  workType: string;
  inSprintAutomated: number;
  backlogAutomated: number;
  uiAutomated: number;
  apiAutomated: number;
  manualWritten: number;
  testCasesExecuted: number;
  passed: number;
  failed: number;
  blocked: number;
  apisRecorded: number;
  defectsRaised: number;
  criticalDefects: number;
  highDefects: number;
  mediumDefects: number;
  lowDefects: number;
  defectsClosed: number;
  flaky?: number;
  reopenedDefects?: number;
  comments: string;
  createdAt: string;
  updatedAt: string;
  qaName?: string;
  moduleName?: string;
  sprintName?: string;
  dailyTotal?: number;
}

export interface DashboardData {
  generatedAt: string;
  range: { start: string; end: string; label: string };
  config: AppConfig;
  kpis: {
    totalTestCases: number;
    manualWritten: number;
    uiAutomated: number;
    apiAutomated: number;
    totalAutomated: number;
    automationCoverage: number;
    apiRecorded: number;
    apiCoverage: number;
    inSprintAutomated: number;
    backlogAutomated: number;
    remaining: number;
    countingMode: string;
    testCasesExecuted?: number;
    passed?: number;
    failed?: number;
    blocked?: number;
    passPct?: number;
    openDefects?: number;
    criticalHighDefects?: number;
  };
  period: Record<string, number>;
  weekComparison?: Record<string, { current: number; previous: number; change: number; changePct: number | null }>;
  sixWeekTrend?: Array<Record<string, string | number>>;
  projectSummaries?: Record<string, any>;
  execution?: Record<string, number>;
  defects?: Record<string, number>;
  risks?: Risk[];
  feeShare?: Record<string, any> | null;
  stories?: Array<{
    id: string;
    moduleId: string;
    moduleName: string;
    userStory: string;
    totalTestCases: number;
    manualWritten: number;
    inSprintAutomated: number;
    backlogAutomated: number;
    uiAutomated: number;
    apiAutomated: number;
    totalAutomated: number;
    automationPct?: string;
    remaining: number | null;
  }>;
  entries?: Array<{
    id: string;
    date: string;
    project: string;
    userId: string;
    qaName: string;
    moduleName: string;
    userStory: string;
    totalTestCases: number;
    totalAutomated: number;
    automationPct: string;
  }>;
  modules: Module[];
  dailyTrend: Array<{
    date: string;
    userId: string;
    qaName: string;
    inSprintAutomated: number;
    backlogAutomated: number;
    uiAutomated: number;
    apiAutomated: number;
    totalAutomated: number;
  }>;
  chartByDate: Array<{
    date: string;
    inSprintAutomated: number;
    backlogAutomated: number;
    uiAutomated: number;
    apiAutomated: number;
    totalAutomated: number;
  }>;
  inSprintVsBacklog: {
    inSprint: { today: number; week: number; sprint: number; cumulative: number };
    backlog: { today: number; week: number; sprint: number; cumulative: number };
  };
  team: Array<{
    userId: string;
    name: string;
    role: string;
    inSprintAutomated: number;
    backlogAutomated: number;
    uiAutomated: number;
    apiAutomated: number;
    totalAutomated: number;
    manualWritten: number;
    testCasesExecuted: number;
    passed: number;
    failed: number;
    blocked: number;
    dailyAverage: number;
    daysLogged: number;
  }>;
  sprints: Sprint[];
  currentSprint?: Sprint;
  achievements: Array<{ date: string; comments: string; qaName?: string; moduleName?: string }>;
}

export interface Risk {
  id: string;
  project: ProjectName;
  title: string;
  impact: string;
  owner: string;
  status: "Open" | "In Progress" | "Resolved";
  expectedResolution: string;
}

export interface Filters {
  preset: string;
  startDate: string;
  endDate: string;
  userId: string;
  moduleId: string;
  sprintId: string;
  automationType: string;
  project?: string;
  userStory?: string;
}

export const emptyDailyUpdate = (): Omit<DailyUpdate, "id" | "createdAt" | "updatedAt"> => ({
  date: "",
  project: "Connect",
  userId: "",
  moduleId: "",
  sprintId: "",
  userStory: "",
  workType: "",
  inSprintAutomated: 0,
  backlogAutomated: 0,
  uiAutomated: 0,
  apiAutomated: 0,
  manualWritten: 0,
  testCasesExecuted: 0,
  passed: 0,
  failed: 0,
  blocked: 0,
  apisRecorded: 0,
  defectsRaised: 0,
  criticalDefects: 0,
  highDefects: 0,
  mediumDefects: 0,
  lowDefects: 0,
  defectsClosed: 0,
  flaky: 0,
  reopenedDefects: 0,
  comments: "",
});
