import type { DailyUpdate, DashboardData, Filters, User } from "../types";
import { bimonthly, buildDashboard, DEFAULT_CONFIG, moduleSnapshot, resolveAutomationTotals, weeklyStatus } from "./analytics";
import { createSeed, WORK_TYPES } from "./seed";
import { syncTeamDb } from "./teamSync";

const KEY = "connect-qa-offline-db-v5";
const SESSION = "connect-qa-offline-user";

function publicUser(user: any): User {
  return { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active };
}

function writeLocal(db: any) {
  localStorage.setItem(KEY, JSON.stringify(db));
  return db;
}

function load() {
  const raw = localStorage.getItem(KEY);
  const db = raw ? JSON.parse(raw) : createSeed();
  const seedUsers = createSeed().users;
  seedUsers.forEach((seedUser) => {
    const existing = (db.users || []).find((u: any) => String(u.email || "").toLowerCase() === seedUser.email.toLowerCase());
    if (!existing) db.users = [...(db.users || []), seedUser];
    else if (!existing.password) existing.password = seedUser.password;
  });
  return writeLocal(db);
}

let syncTail = Promise.resolve();
let syncedAt = 0;

function enqueueSync<T>(task: () => Promise<T>) {
  const run = syncTail.then(task, task);
  syncTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function save(db: any) {
  writeLocal(db);
  if (isOfflineMode()) {
    enqueueSync(async () => {
      const merged = await syncTeamDb(load);
      writeLocal(merged);
      syncedAt = Date.now();
    }).catch(() => undefined);
  }
  return db;
}

async function readDb() {
  return enqueueSync(async () => {
    const local = load();
    if (!isOfflineMode() || Date.now() - syncedAt < 2500) return local;
    try {
      const merged = await syncTeamDb(load);
      writeLocal(merged);
      syncedAt = Date.now();
      return load();
    } catch {
      return local;
    }
  });
}

function rememberDeleted(db: any, bucket: string, ids: string[]) {
  const current = Array.isArray(db.deleted?.[bucket]) ? db.deleted[bucket] : [];
  db.deleted = { ...(db.deleted || {}), [bucket]: Array.from(new Set([...current, ...ids.filter(Boolean)])) };
}

function currentUser() {
  const raw = localStorage.getItem(SESSION);
  return raw ? JSON.parse(raw) : null;
}

function enrich(row: any, db: any) {
  return {
    ...row,
    project: row.project || db.modules.find((m: any) => m.id === row.moduleId)?.project || "Connect",
    qaName: db.users.find((u: any) => u.id === row.userId)?.name,
    moduleName: db.modules.find((m: any) => m.id === row.moduleId)?.name,
    sprintName: db.sprints.find((s: any) => s.id === row.sprintId)?.sprintName,
    dailyTotal: Math.max(
      Number(row.inSprintAutomated || 0) + Number(row.backlogAutomated || 0),
      Number(row.uiAutomated || 0) + Number(row.apiAutomated || 0)
    ),
  };
}

function uniqueKey(row: any) {
  return [row.date, row.project || "Connect", row.userId, row.moduleId, String(row.userStory || "").trim().toLowerCase()].join("|");
}

export const offline = {
  async login(email: string, password: string) {
    const db = await readDb();
    const normalized = String(email || "").trim().toLowerCase();
    const pass = String(password || "").trim();
    const candidates = normalized.includes("@") ? [normalized] : [normalized, `${normalized}@connect.qa`];
    const user = db.users.find(
      (u: any) => candidates.includes(String(u.email || "").toLowerCase()) && u.password === pass && u.active
    );
    if (!user) throw { response: { data: { message: "Invalid email or password." } } };
    localStorage.setItem(SESSION, JSON.stringify(publicUser(user)));
    return { token: "offline-token", user: publicUser(user) };
  },
  me() {
    const user = currentUser();
    if (!user) throw { response: { status: 401 } };
    return user;
  },
  async getMeta() {
    const db = await readDb();
    return {
      workTypes: WORK_TYPES,
      roles: ["qa", "lead", "admin"],
      users: db.users.filter((u: any) => u.active).map(publicUser),
      modules: db.modules,
      sprints: db.sprints,
      risks: db.risks || [],
      projects: ["Connect", "Force"],
      config: { ...DEFAULT_CONFIG, ...db.config },
    };
  },
  async getDashboard(filters: Filters) {
    return buildDashboard(await readDb(), filters) as DashboardData;
  },
  async getWeekly(weekStart: string) {
    return weeklyStatus((await readDb()).dailyUpdates, weekStart);
  },
  async getBimonthly(startDate: string, endDate: string) {
    const db = await readDb();
    return bimonthly(db.modules, db.dailyUpdates, startDate, endDate, { ...DEFAULT_CONFIG, ...db.config });
  },
  async getModuleDetail(id: string) {
    const db = await readDb();
    const config = { ...DEFAULT_CONFIG, ...db.config };
    const mod = db.modules.find((m: any) => m.id === id);
    const rows = db.dailyUpdates.filter((u: any) => u.moduleId === id);
    const contributors = [...new Set(rows.map((r: any) => r.userId))].map((userId) => {
      const mine = rows.filter((r: any) => r.userId === userId);
      return {
        userId,
        name: db.users.find((u: any) => u.id === userId)?.name,
        totalAutomated: mine.reduce((a: number, r: any) => a + Number(r.inSprintAutomated || 0) + Number(r.backlogAutomated || 0), 0),
        uiAutomated: mine.reduce((a: number, r: any) => a + Number(r.uiAutomated || 0), 0),
        apiAutomated: mine.reduce((a: number, r: any) => a + Number(r.apiAutomated || 0), 0),
      };
    });
    const sprints: Record<string, any> = {};
    rows.forEach((r: any) => {
      if (!sprints[r.sprintId]) sprints[r.sprintId] = { sprintId: r.sprintId, sprintName: db.sprints.find((s: any) => s.id === r.sprintId)?.sprintName, inSprintAutomated: 0, backlogAutomated: 0, uiAutomated: 0, apiAutomated: 0 };
      sprints[r.sprintId].inSprintAutomated += Number(r.inSprintAutomated || 0);
      sprints[r.sprintId].backlogAutomated += Number(r.backlogAutomated || 0);
      sprints[r.sprintId].uiAutomated += Number(r.uiAutomated || 0);
      sprints[r.sprintId].apiAutomated += Number(r.apiAutomated || 0);
    });
    const trend: Record<string, any> = {};
    rows.forEach((r: any) => {
      if (!trend[r.date]) trend[r.date] = { date: r.date, uiAutomated: 0, apiAutomated: 0, inSprintAutomated: 0, backlogAutomated: 0 };
      trend[r.date].uiAutomated += Number(r.uiAutomated || 0);
      trend[r.date].apiAutomated += Number(r.apiAutomated || 0);
      trend[r.date].inSprintAutomated += Number(r.inSprintAutomated || 0);
      trend[r.date].backlogAutomated += Number(r.backlogAutomated || 0);
    });
    return { module: moduleSnapshot(mod, db.dailyUpdates, config), contributors, sprints: Object.values(sprints), trend: Object.values(trend), updates: rows };
  },
  async listUpdates() {
    const db = await readDb();
    return db.dailyUpdates
      .slice()
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
      .map((row: any) => enrich(row, db));
  },
  async lookupUpdate(params: Record<string, string>) {
    const db = await readDb();
    const found = db.dailyUpdates.find((row: any) => uniqueKey(row) === uniqueKey(params));
    return found ? enrich(found, db) : null;
  },
  async saveUpdate(payload: Partial<DailyUpdate>, filters: Filters) {
    const db = await readDb();
    const next = { ...payload, project: payload.project === "Force" ? "Force" : "Connect", userId: payload.userId };
    if (!next.date || !next.project || !next.userId || !next.moduleId || !next.sprintId || !next.workType || !String(next.userStory || "").trim()) {
      throw { response: { data: { message: "Date, project, QA name, module, sprint, user story, and work type are mandatory." } } };
    }
    if (Number(next.passed || 0) + Number(next.failed || 0) + Number(next.blocked || 0) > Number(next.testCasesExecuted || 0)) {
      throw { response: { data: { message: "Passed + Failed + Blocked cannot exceed test cases executed today." } } };
    }
    if (
      Number(next.criticalDefects || 0) + Number(next.highDefects || 0) + Number(next.mediumDefects || 0) + Number(next.lowDefects || 0) >
      Number(next.defectsRaised || 0)
    ) {
      throw { response: { data: { message: "Severity totals cannot exceed defects raised." } } };
    }
    const numericKeys = [
      "inSprintAutomated", "backlogAutomated", "uiAutomated", "apiAutomated", "manualWritten", "testCasesExecuted",
      "passed", "failed", "blocked", "apisRecorded", "defectsRaised", "criticalDefects", "highDefects", "mediumDefects",
      "lowDefects", "defectsClosed", "flaky", "reopenedDefects",
    ];
    if (numericKeys.some((key) => Number((next as any)[key] || 0) < 0)) {
      throw { response: { data: { message: "Negative values are not allowed." } } };
    }
    const existing = db.dailyUpdates.find((row: any) => uniqueKey(row) === uniqueKey(next));
    const others = db.dailyUpdates.filter((row: any) => row.moduleId === next.moduleId && row.id !== existing?.id);
    const mod = db.modules.find((m: any) => m.id === next.moduleId);
    if (!mod) throw { response: { data: { message: "Module is required. Type a module name to add it." } } };
    const snapshot = moduleSnapshot(mod, others, db.config);
    const nextTotal = resolveAutomationTotals({
      uiAutomated: snapshot.current.uiAutomated + Number(next.uiAutomated || 0),
      apiAutomated: snapshot.current.apiAutomated + Number(next.apiAutomated || 0),
      inSprintAutomated: snapshot.current.inSprintAutomated + Number(next.inSprintAutomated || 0),
      backlogAutomated: snapshot.current.backlogAutomated + Number(next.backlogAutomated || 0),
      manualWritten: snapshot.current.manualWritten + Number(next.manualWritten || 0),
      testCasesExecuted: snapshot.current.testCasesExecuted + Number(next.testCasesExecuted || 0),
      baselineTotalTestCases: mod.totalTestCases,
      countingMode: db.config.countingMode,
    }).totalAutomated;
    if (Number(mod.totalTestCases) > 0 && !db.config.allowAutomationExceedScope && nextTotal > Number(mod.totalTestCases)) {
      throw { response: { data: { message: `Automated test cases cannot exceed Total TC (${mod.totalTestCases}) for ${mod.name}.` } } };
    }
    const nextApi = snapshot.current.apiAutomated + Number(next.apiAutomated || 0);
    const nextRecorded = snapshot.current.apiRecorded + Number(next.apisRecorded || 0);
    if (nextRecorded > 0 && !db.config.allowApiExceedRecorded && nextApi > nextRecorded) {
      throw { response: { data: { message: "API automated cannot exceed APIs recorded." } } };
    }
    const now = new Date().toISOString();
    let saved: any;
    if (existing) {
      saved = { ...existing, ...next, updatedAt: now };
      db.dailyUpdates = db.dailyUpdates.map((row: any) => (row.id === existing.id ? saved : row));
    } else {
      saved = { id: `du-${Date.now()}`, ...next, createdAt: now, updatedAt: now };
      db.dailyUpdates.push(saved);
    }
    save(db);
    return { update: enrich(saved, db), dashboard: buildDashboard(db, filters), replaced: Boolean(existing) };
  },
  async saveUser(payload: Partial<User> & { password?: string }, id?: string) {
    const db = await readDb();
    if (!id) {
      const created = {
        id: `user-${Date.now()}`,
        name: payload.name,
        email: payload.email || `${String(payload.name).toLowerCase().replace(/[^a-z0-9]+/g, ".")}@connect.qa`,
        role: payload.role || "qa",
        active: payload.active ?? true,
        password: payload.password || "Connect@123",
      };
      db.users.push(created);
      save(db);
      return publicUser(created);
    }
    db.users = db.users.map((user: any) => (user.id === id ? { ...user, ...payload, name: String(payload.name || user.name).trim() } : user));
    save(db);
    return publicUser(db.users.find((u: any) => u.id === id));
  },
  async resolveQaName(name: string) {
    const db = await readDb();
    const trimmed = name.trim();
    const existing = db.users.find((u: any) => u.active && u.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return publicUser(existing);
    return this.saveUser({ name: trimmed, role: "qa" });
  },
  async resolveModule(name: string, project?: string) {
    const db = await readDb();
    const proj = project === "Force" ? "Force" : "Connect";
    const existing = db.modules.find((m: any) => m.name.toLowerCase() === name.trim().toLowerCase() && (m.project || "Connect") === proj);
    if (existing) return existing;
    return this.saveModule({
      name: name.trim(),
      project: proj,
      totalTestCases: 0,
      manualWritten: 0,
      uiAutomated: 0,
      apiRecorded: 0,
      apiAutomated: 0,
    });
  },
  async resolveSprint(sprintName: string, project?: string) {
    const db = await readDb();
    const proj = project === "Force" ? "Force" : "Connect";
    const existing = db.sprints.find((s: any) => s.sprintName.toLowerCase() === sprintName.trim().toLowerCase() && (s.project || "Connect") === proj);
    if (existing) return existing;
    const today = new Date().toISOString().slice(0, 10);
    const created = this.saveSprint({
      sprintName: sprintName.trim(),
      project: proj,
      startDate: today,
      endDate: today,
      plannedTestCases: 0,
    });
    if (!db.config.currentSprintId) this.saveConfig({ currentSprintId: created.id });
    return created;
  },
  async listUsers() {
    return (await readDb()).users.map(publicUser);
  },
  async saveModule(payload: Record<string, unknown>, id?: string) {
    const db = await readDb();
    if (!id) {
      const created = { id: `mod-${Date.now()}`, baselineLocked: false, ...payload };
      db.modules.push(created);
      save(db);
      return created;
    }
    db.modules = db.modules.map((mod: any) => (mod.id === id ? { ...mod, ...payload } : mod));
    save(db);
    return db.modules.find((m: any) => m.id === id);
  },
  async deleteModule(id: string) {
    const db = await readDb();
    rememberDeleted(db, "modules", [id]);
    rememberDeleted(
      db,
      "dailyUpdates",
      (db.dailyUpdates || []).filter((row: any) => row.moduleId === id).map((row: any) => row.id)
    );
    db.modules = (db.modules || []).filter((mod: any) => mod.id !== id);
    db.dailyUpdates = (db.dailyUpdates || []).filter((row: any) => row.moduleId !== id);
    save(db);
  },
  async saveSprint(payload: Record<string, unknown>, id?: string) {
    const db = await readDb();
    const executionKeys = ["inSprintAutoExecuted", "inSprintAutoPassed", "inSprintAutoFailed", "inSprintAutoBlocked", "inSprintExecutionNotes"];
    const hasExecution = executionKeys.some((key) => payload[key] != null);
    const execution: Record<string, unknown> = {
      inSprintAutoExecuted: Number(payload.inSprintAutoExecuted ?? 0) || 0,
      inSprintAutoPassed: Number(payload.inSprintAutoPassed ?? 0) || 0,
      inSprintAutoFailed: Number(payload.inSprintAutoFailed ?? 0) || 0,
      inSprintAutoBlocked: Number(payload.inSprintAutoBlocked ?? 0) || 0,
      inSprintExecutionNotes: String(payload.inSprintExecutionNotes || ""),
    };
    if (hasExecution) {
      const resultTotal = Number(execution.inSprintAutoPassed) + Number(execution.inSprintAutoFailed) + Number(execution.inSprintAutoBlocked);
      const executed = Number(execution.inSprintAutoExecuted);
      if (resultTotal > 0 && executed > 0 && resultTotal !== executed) {
        throw { response: { data: { message: "Passed + Failed + Blocked must equal the in-sprint automation test cases executed." } } };
      }
      execution.inSprintExecutionRecordedAt = new Date().toISOString();
    }
    if (!id) {
      const created = { id: `sprint-${Date.now()}`, ...payload, ...execution };
      db.sprints.push(created);
      save(db);
      return created;
    }
    db.sprints = db.sprints.map((sprint: any) => (sprint.id === id ? { ...sprint, ...payload, ...(hasExecution ? execution : {}) } : sprint));
    save(db);
    return db.sprints.find((s: any) => s.id === id);
  },
  async deleteSprint(id: string) {
    const db = await readDb();
    rememberDeleted(db, "sprints", [id]);
    rememberDeleted(
      db,
      "dailyUpdates",
      (db.dailyUpdates || []).filter((row: any) => row.sprintId === id).map((row: any) => row.id)
    );
    db.sprints = (db.sprints || []).filter((sprint: any) => sprint.id !== id);
    db.dailyUpdates = (db.dailyUpdates || []).filter((row: any) => row.sprintId !== id);
    if (db.config?.currentSprintId === id) db.config.currentSprintId = "";
    save(db);
  },
  async saveConfig(payload: Record<string, unknown>) {
    const db = await readDb();
    db.config = { ...DEFAULT_CONFIG, ...db.config, ...payload, updatedAt: new Date().toISOString() };
    save(db);
    return db.config;
  },
  async downloadExcel(filters: Filters) {
    const dash = buildDashboard(await readDb(), filters);
    const rows = [["Metric", "Value"], ...Object.entries(dash.kpis), [], ["Module", "Total TC", "UI", "API", "Coverage"], ...dash.modules.map((m: any) => [m.name, m.current.totalTestCases, m.current.uiAutomated, m.current.apiAutomated, m.current.coverage])];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filters.project || "qa"}-weekly-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },
  async listRisks() {
    return (await readDb()).risks || [];
  },
  async saveRisk(payload: Record<string, unknown>, id?: string) {
    const db = await readDb();
    if (!db.risks) db.risks = [];
    if (!id) {
      const created = {
        id: `risk-${Date.now()}`,
        project: payload.project === "Force" ? "Force" : "Connect",
        title: String(payload.title || "").trim(),
        impact: String(payload.impact || "").trim(),
        owner: String(payload.owner || "").trim(),
        status: payload.status || "Open",
        expectedResolution: String(payload.expectedResolution || ""),
      };
      db.risks.push(created);
      save(db);
      return created;
    }
    db.risks = db.risks.map((risk: any) => (risk.id === id ? { ...risk, ...payload } : risk));
    save(db);
    return db.risks.find((r: any) => r.id === id);
  },
  async deleteRisk(id: string) {
    const db = await readDb();
    rememberDeleted(db, "risks", [id]);
    db.risks = (db.risks || []).filter((r: any) => r.id !== id);
    save(db);
  },
};

export function isOfflineMode() {
  return import.meta.env.VITE_OFFLINE === "true" || window.location.hostname.endsWith("github.io");
}
