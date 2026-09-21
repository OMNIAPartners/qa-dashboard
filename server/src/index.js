const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const ExcelJS = require("exceljs");
const { getDb, saveDb, reloadDb } = require("./db");
const { seed } = require("./seed");
const { WORK_TYPES, ROLES, PROJECTS, DEFAULT_CONFIG } = require("./constants");
const {
  buildDashboard,
  weeklyStatus,
  bimonthly,
  moduleSnapshot,
} = require("./analytics");
const { validateDailyPayload, validateAgainstBaselines, uniqueKey } = require("./validation");

const SECRET = process.env.JWT_SECRET || "connect-qa-dashboard-dev-secret";
const PORT = process.env.PORT || 4000;

if (!fs.existsSync(path.join(__dirname, "..", "data", "db.json"))) {
  seed();
} else {
  reloadDb();
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: "12h" });
}

function auth(requiredRoles) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Sign in is required." });
    try {
      const payload = jwt.verify(token, SECRET);
      const user = getDb().users.find((u) => u.id === payload.id && u.active);
      if (!user) return res.status(401).json({ message: "Account is not active." });
      if (requiredRoles && !requiredRoles.includes(user.role)) {
        return res.status(403).json({ message: "You do not have access to this action." });
      }
      req.user = { id: user.id, role: user.role, name: user.name, email: user.email };
      next();
    } catch {
      return res.status(401).json({ message: "Session expired. Please sign in again." });
    }
  };
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active };
}

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "").trim();
  const user = getDb().users.find((u) => u.email.toLowerCase() === email);
  if (!user || !user.active || !bcrypt.compareSync(password || "", user.passwordHash)) {
    return res.status(401).json({ message: "Invalid email or password." });
  }
  res.json({ token: sign(user), user: publicUser(user) });
});

app.get("/api/auth/me", auth(), (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/meta", auth(), (req, res) => {
  const db = getDb();
  res.json({
    workTypes: WORK_TYPES,
    roles: ROLES,
    users: db.users.filter((u) => u.active).map(publicUser),
    modules: db.modules,
    sprints: db.sprints,
    risks: db.risks || [],
    projects: PROJECTS,
    config: { ...DEFAULT_CONFIG, ...db.config },
  });
});

app.get("/api/dashboard", auth(), (req, res) => {
  res.json(buildDashboard(getDb(), req.query));
});

app.get("/api/reports/weekly", auth(), (req, res) => {
  const weekStart = req.query.weekStart;
  if (!weekStart) return res.status(400).json({ message: "weekStart is required." });
  res.json(weeklyStatus(getDb().dailyUpdates, weekStart));
});

app.get("/api/reports/bimonthly", auth(), (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ message: "startDate and endDate are required." });
  const db = getDb();
  res.json(bimonthly(db.modules, db.dailyUpdates, startDate, endDate, { ...DEFAULT_CONFIG, ...db.config }));
});

app.get("/api/modules/:id/detail", auth(), (req, res) => {
  const db = getDb();
  const mod = db.modules.find((m) => m.id === req.params.id);
  if (!mod) return res.status(404).json({ message: "Module not found." });
  const config = { ...DEFAULT_CONFIG, ...db.config };
  const snapshot = moduleSnapshot(mod, db.dailyUpdates, config);
  const rows = db.dailyUpdates.filter((u) => u.moduleId === mod.id);
  const contributors = [...new Set(rows.map((r) => r.userId))].map((id) => {
    const user = db.users.find((u) => u.id === id);
    const mine = rows.filter((r) => r.userId === id);
    return {
      userId: id,
      name: user?.name,
      totalAutomated: mine.reduce((a, r) => a + Number(r.inSprintAutomated || 0) + Number(r.backlogAutomated || 0), 0),
      uiAutomated: mine.reduce((a, r) => a + Number(r.uiAutomated || 0), 0),
      apiAutomated: mine.reduce((a, r) => a + Number(r.apiAutomated || 0), 0),
    };
  });
  const sprintMap = {};
  rows.forEach((r) => {
    if (!sprintMap[r.sprintId]) {
      const sprint = db.sprints.find((s) => s.id === r.sprintId);
      sprintMap[r.sprintId] = {
        sprintId: r.sprintId,
        sprintName: sprint?.sprintName || r.sprintId,
        inSprintAutomated: 0,
        backlogAutomated: 0,
        uiAutomated: 0,
        apiAutomated: 0,
      };
    }
    sprintMap[r.sprintId].inSprintAutomated += Number(r.inSprintAutomated || 0);
    sprintMap[r.sprintId].backlogAutomated += Number(r.backlogAutomated || 0);
    sprintMap[r.sprintId].uiAutomated += Number(r.uiAutomated || 0);
    sprintMap[r.sprintId].apiAutomated += Number(r.apiAutomated || 0);
  });
  const trend = {};
  rows.forEach((r) => {
    if (!trend[r.date]) trend[r.date] = { date: r.date, uiAutomated: 0, apiAutomated: 0, inSprintAutomated: 0, backlogAutomated: 0 };
    trend[r.date].uiAutomated += Number(r.uiAutomated || 0);
    trend[r.date].apiAutomated += Number(r.apiAutomated || 0);
    trend[r.date].inSprintAutomated += Number(r.inSprintAutomated || 0);
    trend[r.date].backlogAutomated += Number(r.backlogAutomated || 0);
  });
  res.json({
    module: snapshot,
    contributors,
    sprints: Object.values(sprintMap),
    trend: Object.values(trend).sort((a, b) => a.date.localeCompare(b.date)),
    updates: rows.sort((a, b) => b.date.localeCompare(a.date)),
  });
});

app.get("/api/daily-updates", auth(), (req, res) => {
  const db = getDb();
  let rows = db.dailyUpdates;
  if (req.user.role === "qa") rows = rows.filter((r) => r.userId === req.user.id);
  if (req.query.userId) rows = rows.filter((r) => r.userId === req.query.userId);
  if (req.query.moduleId) rows = rows.filter((r) => r.moduleId === req.query.moduleId);
  if (req.query.date) rows = rows.filter((r) => r.date === req.query.date);
  res.json(
    rows
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
      .map((row) => enrichUpdate(row, db))
  );
});

app.get("/api/daily-updates/lookup", auth(), (req, res) => {
  const { date, userId, moduleId, userStory, project } = req.query;
  const targetUser = req.user.role === "qa" ? req.user.id : userId;
  const match = getDb().dailyUpdates.find(
    (row) => uniqueKey(row) === uniqueKey({ date, userId: targetUser, moduleId, userStory, project: project || "Connect" })
  );
  res.json({ existing: match ? enrichUpdate(match, getDb()) : null });
});

app.post("/api/daily-updates", auth(), (req, res) => {
  const db = getDb();
  const payload = { ...req.body };
  if (req.user.role === "qa") payload.userId = req.user.id;
  const { errors, numbers } = validateDailyPayload(payload);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  const key = uniqueKey(payload);
  const existing = db.dailyUpdates.find((row) => uniqueKey(row) === key);
  const baselineErrors = validateAgainstBaselines(db, payload, numbers, existing?.id);
  if (baselineErrors.length) return res.status(400).json({ message: baselineErrors[0], errors: baselineErrors });

  const now = new Date().toISOString();
  let saved;
  saveDb((state) => {
    if (existing) {
      if (req.user.role === "qa" && existing.userId !== req.user.id) {
        return state;
      }
      saved = {
        ...existing,
        ...payload,
        ...numbers,
        userStory: String(payload.userStory).trim(),
        comments: payload.comments || "",
        updatedAt: now,
      };
      state.dailyUpdates = state.dailyUpdates.map((row) => (row.id === existing.id ? saved : row));
      state.auditLogs.push({
        id: uuid(),
        dailyUpdateId: existing.id,
        action: "update",
        actorId: req.user.id,
        before: existing,
        after: saved,
        createdAt: now,
      });
    } else {
      saved = {
        id: uuid(),
        ...payload,
        ...numbers,
        userStory: String(payload.userStory).trim(),
        comments: payload.comments || "",
        createdAt: now,
        updatedAt: now,
      };
      state.dailyUpdates.push(saved);
      state.auditLogs.push({
        id: uuid(),
        dailyUpdateId: saved.id,
        action: "create",
        actorId: req.user.id,
        before: null,
        after: saved,
        createdAt: now,
      });
    }
    return state;
  });

  if (!saved) return res.status(403).json({ message: "You can only edit your own updates." });
  res.json({
    update: enrichUpdate(saved, getDb()),
    dashboard: buildDashboard(getDb(), req.query),
    replaced: Boolean(existing),
  });
});

app.delete("/api/daily-updates/:id", auth(["lead", "admin"]), (req, res) => {
  saveDb((state) => {
    state.dailyUpdates = state.dailyUpdates.filter((row) => row.id !== req.params.id);
    return state;
  });
  res.json({ ok: true });
});

app.get("/api/audit/:id", auth(["lead", "admin"]), (req, res) => {
  res.json(getDb().auditLogs.filter((log) => log.dailyUpdateId === req.params.id));
});

function slugEmail(name) {
  const slug = String(name || "qa")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${slug || "qa"}@connect.qa`;
}

function createQaUser(name, extras = {}) {
  const email = extras.email || slugEmail(name);
  return {
    id: uuid(),
    name: String(name).trim(),
    email,
    role: extras.role || "qa",
    active: extras.active !== false,
    passwordHash: bcrypt.hashSync(extras.password || "Connect@123", 10),
  };
}

app.get("/api/users", auth(["admin", "lead"]), (req, res) => {
  res.json(getDb().users.map(publicUser));
});

app.post("/api/users/resolve", auth(), (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ message: "QA name is required." });
  const db = getDb();
  const existing = db.users.find((u) => u.active && u.name.toLowerCase() === name.toLowerCase());
  if (existing) return res.json(publicUser(existing));

  if (req.user.role === "qa") {
    let updated;
    saveDb((state) => {
      state.users = state.users.map((user) => {
        if (user.id !== req.user.id) return user;
        updated = { ...user, name };
        return updated;
      });
      return state;
    });
    return res.json(publicUser(updated));
  }

  const created = createQaUser(name);
  saveDb((state) => {
    state.users.push(created);
    return state;
  });
  res.json(publicUser(created));
});

app.post("/api/users", auth(["admin", "lead"]), (req, res) => {
  const { name, email, role = "qa", password = "Connect@123", active = true } = req.body || {};
  if (!name) return res.status(400).json({ message: "QA name is required." });
  if (role && !ROLES.includes(role)) return res.status(400).json({ message: "Invalid role." });
  if (req.user.role === "lead" && role && role !== "qa") {
    return res.status(403).json({ message: "QA Leads can add QA users only." });
  }
  const db = getDb();
  const nextEmail = email || slugEmail(name);
  if (db.users.some((u) => u.email.toLowerCase() === nextEmail.toLowerCase())) {
    return res.status(400).json({ message: "A user with this email already exists." });
  }
  const user = createQaUser(name, { email: nextEmail, role, password, active });
  saveDb((state) => {
    state.users.push(user);
    return state;
  });
  res.json(publicUser(user));
});

app.put("/api/users/:id", auth(), (req, res) => {
  const db = getDb();
  const current = db.users.find((u) => u.id === req.params.id);
  if (!current) return res.status(404).json({ message: "User not found." });
  const isSelf = req.user.id === current.id;
  const isManager = req.user.role === "admin" || req.user.role === "lead";
  if (!isSelf && !isManager) return res.status(403).json({ message: "You can only edit your own name." });
  if (req.user.role === "lead" && current.role === "admin") {
    return res.status(403).json({ message: "QA Leads cannot change administrator accounts." });
  }
  if (req.user.role === "qa" && Object.keys(req.body || {}).some((key) => !["name"].includes(key))) {
    return res.status(403).json({ message: "QA users can only edit their display name." });
  }
  const nextName = req.body.name != null ? String(req.body.name).trim() : current.name;
  if (!nextName) return res.status(400).json({ message: "QA name cannot be empty." });
  let updated;
  saveDb((state) => {
    state.users = state.users.map((user) => {
      if (user.id !== req.params.id) return user;
      updated = {
        ...user,
        name: nextName,
        email: req.user.role === "admin" ? req.body.email ?? user.email : user.email,
        role: req.user.role === "admin" ? req.body.role ?? user.role : user.role,
        active: req.user.role === "admin" || req.user.role === "lead" ? req.body.active ?? user.active : user.active,
        passwordHash:
          req.user.role === "admin" && req.body.password ? bcrypt.hashSync(req.body.password, 10) : user.passwordHash,
      };
      return updated;
    });
    return state;
  });
  res.json(publicUser(updated));
});

app.post("/api/modules/resolve", auth(), (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ message: "Module is mandatory." });
  const db = getDb();
  const existing = db.modules.find((m) => m.name.toLowerCase() === name.toLowerCase() && (m.project || "Connect") === (req.body.project === "Force" ? "Force" : "Connect"));
  if (existing) return res.json(existing);
  const mod = {
    id: uuid(),
    name,
    project: req.body.project === "Force" ? "Force" : "Connect",
    totalTestCases: Number(req.body.totalTestCases) || 0,
    manualWritten: 0,
    uiAutomated: 0,
    apiRecorded: 0,
    apiAutomated: 0,
    baselineLocked: false,
  };
  saveDb((state) => {
    state.modules.push(mod);
    return state;
  });
  res.json(mod);
});

app.post("/api/sprints/resolve", auth(), (req, res) => {
  const sprintName = String(req.body?.sprintName || req.body?.name || "").trim();
  if (!sprintName) return res.status(400).json({ message: "Sprint is mandatory." });
  const db = getDb();
  const existing = db.sprints.find((s) => s.sprintName.toLowerCase() === sprintName.toLowerCase() && (s.project || "Connect") === (req.body.project === "Force" ? "Force" : "Connect"));
  if (existing) return res.json(existing);
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sprint = {
    id: uuid(),
    sprintName,
    project: req.body.project === "Force" ? "Force" : "Connect",
    startDate: req.body.startDate || today,
    endDate: req.body.endDate || end,
    plannedTestCases: Number(req.body.plannedTestCases) || 0,
  };
  saveDb((state) => {
    state.sprints.push(sprint);
    if (!state.config.currentSprintId) state.config.currentSprintId = sprint.id;
    return state;
  });
  res.json(sprint);
});

app.post("/api/modules", auth(["lead", "admin"]), (req, res) => {
  const body = req.body || {};
  if (!body.name) {
    return res.status(400).json({ message: "Module name is required." });
  }
  const mod = {
    id: uuid(),
    name: body.name,
    project: body.project === "Force" ? "Force" : "Connect",
    isFeeShare: Boolean(body.isFeeShare),
    totalTestCases: Number(body.totalTestCases) || 0,
    manualWritten: Number(body.manualWritten) || 0,
    uiAutomated: Number(body.uiAutomated) || 0,
    apiRecorded: Number(body.apiRecorded) || 0,
    apiAutomated: Number(body.apiAutomated) || 0,
    baselineLocked: false,
  };
  saveDb((state) => {
    state.modules.push(mod);
    return state;
  });
  res.json(mod);
});

app.put("/api/modules/:id", auth(["lead", "admin"]), (req, res) => {
  const current = getDb().modules.find((m) => m.id === req.params.id);
  if (!current) return res.status(404).json({ message: "Module not found." });
  if (current.baselineLocked && req.user.role !== "admin" && req.body.baselineChange) {
    return res.status(403).json({ message: "Only an administrator can change baseline scope." });
  }
  let updated;
  saveDb((state) => {
    state.modules = state.modules.map((mod) => {
      if (mod.id !== req.params.id) return mod;
      updated = {
        ...mod,
        name: req.body.name ?? mod.name,
        project: req.body.project ?? mod.project ?? "Connect",
        isFeeShare: req.body.isFeeShare != null ? Boolean(req.body.isFeeShare) : Boolean(mod.isFeeShare),
        totalTestCases: req.body.totalTestCases != null ? Number(req.body.totalTestCases) : mod.totalTestCases,
        manualWritten: req.body.manualWritten != null ? Number(req.body.manualWritten) : mod.manualWritten,
        uiAutomated: req.body.uiAutomated != null ? Number(req.body.uiAutomated) : mod.uiAutomated,
        apiRecorded: req.body.apiRecorded != null ? Number(req.body.apiRecorded) : mod.apiRecorded,
        apiAutomated: req.body.apiAutomated != null ? Number(req.body.apiAutomated) : mod.apiAutomated,
      };
      return updated;
    });
    return state;
  });
  res.json(updated);
});

app.delete("/api/modules/:id", auth(["lead", "admin"]), (req, res) => {
  const current = getDb().modules.find((m) => m.id === req.params.id);
  if (!current) return res.status(404).json({ message: "Module not found." });
  saveDb((state) => {
    state.modules = state.modules.filter((mod) => mod.id !== req.params.id);
    state.dailyUpdates = state.dailyUpdates.filter((row) => row.moduleId !== req.params.id);
    return state;
  });
  res.json({ ok: true });
});

app.post("/api/sprints", auth(["lead", "admin"]), (req, res) => {
  const { sprintName, startDate, endDate, plannedTestCases, project } = req.body || {};
  if (!sprintName || !startDate || !endDate) {
    return res.status(400).json({ message: "Sprint name, start date, and end date are required." });
  }
  const sprint = {
    id: uuid(),
    sprintName,
    project: project === "Force" ? "Force" : "Connect",
    startDate,
    endDate,
    plannedTestCases: Number(plannedTestCases) || 0,
    inSprintAutoExecuted: 0,
    inSprintAutoPassed: 0,
    inSprintAutoFailed: 0,
    inSprintAutoBlocked: 0,
    inSprintExecutionNotes: "",
    inSprintExecutionRecordedAt: "",
  };
  saveDb((state) => {
    state.sprints.push(sprint);
    return state;
  });
  res.json(sprint);
});

function sprintExecutionFields(body, current = {}) {
  const executed = body.inSprintAutoExecuted != null ? Number(body.inSprintAutoExecuted) : Number(current.inSprintAutoExecuted || 0);
  const passed = body.inSprintAutoPassed != null ? Number(body.inSprintAutoPassed) : Number(current.inSprintAutoPassed || 0);
  const failed = body.inSprintAutoFailed != null ? Number(body.inSprintAutoFailed) : Number(current.inSprintAutoFailed || 0);
  const blocked = body.inSprintAutoBlocked != null ? Number(body.inSprintAutoBlocked) : Number(current.inSprintAutoBlocked || 0);
  return {
    inSprintAutoExecuted: Number.isFinite(executed) ? Math.max(0, executed) : 0,
    inSprintAutoPassed: Number.isFinite(passed) ? Math.max(0, passed) : 0,
    inSprintAutoFailed: Number.isFinite(failed) ? Math.max(0, failed) : 0,
    inSprintAutoBlocked: Number.isFinite(blocked) ? Math.max(0, blocked) : 0,
    inSprintExecutionNotes: body.inSprintExecutionNotes != null ? String(body.inSprintExecutionNotes) : current.inSprintExecutionNotes || "",
    inSprintExecutionRecordedAt:
      body.inSprintAutoExecuted != null ||
      body.inSprintAutoPassed != null ||
      body.inSprintAutoFailed != null ||
      body.inSprintAutoBlocked != null ||
      body.inSprintExecutionNotes != null
        ? new Date().toISOString()
        : current.inSprintExecutionRecordedAt || "",
  };
}

app.put("/api/sprints/:id", auth(), (req, res) => {
  const current = getDb().sprints.find((s) => s.id === req.params.id);
  if (!current) return res.status(404).json({ message: "Sprint not found." });
  const isManager = req.user.role === "admin" || req.user.role === "lead";
  const execution = sprintExecutionFields(req.body || {}, current);
  const resultTotal = execution.inSprintAutoPassed + execution.inSprintAutoFailed + execution.inSprintAutoBlocked;
  if (resultTotal !== execution.inSprintAutoExecuted) {
    return res.status(400).json({ message: "Passed + Failed + Blocked must equal the in-sprint automation test cases executed." });
  }
  let updated;
  saveDb((state) => {
    state.sprints = state.sprints.map((sprint) => {
      if (sprint.id !== req.params.id) return sprint;
      updated = {
        ...sprint,
        ...execution,
        sprintName: isManager ? req.body.sprintName ?? sprint.sprintName : sprint.sprintName,
        startDate: isManager ? req.body.startDate ?? sprint.startDate : sprint.startDate,
        endDate: isManager ? req.body.endDate ?? sprint.endDate : sprint.endDate,
        plannedTestCases: isManager && req.body.plannedTestCases != null ? Number(req.body.plannedTestCases) : sprint.plannedTestCases,
        project: isManager && req.body.project ? (req.body.project === "Force" ? "Force" : "Connect") : sprint.project,
      };
      return updated;
    });
    return state;
  });
  res.json(updated);
});

app.get("/api/config", auth(), (req, res) => {
  res.json({ ...DEFAULT_CONFIG, ...getDb().config });
});

app.put("/api/config", auth(["admin", "lead"]), (req, res) => {
  let next;
  saveDb((state) => {
    next = { ...DEFAULT_CONFIG, ...state.config, ...req.body };
    state.config = next;
    return state;
  });
  res.json(next);
});

app.get("/api/export/excel", auth(["lead", "admin"]), async (req, res) => {
  const dashboard = buildDashboard(getDb(), req.query);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Connect QA Dashboard";
  const kpiSheet = workbook.addWorksheet("KPIs");
  kpiSheet.columns = [
    { header: "Metric", key: "metric", width: 32 },
    { header: "Value", key: "value", width: 18 },
  ];
  Object.entries(dashboard.kpis).forEach(([metric, value]) => kpiSheet.addRow({ metric, value }));

  const moduleSheet = workbook.addWorksheet("Modules");
  moduleSheet.columns = [
    { header: "Module", key: "name", width: 36 },
    { header: "Total TC", key: "total", width: 12 },
    { header: "Manual", key: "manual", width: 12 },
    { header: "UI Automated", key: "ui", width: 14 },
    { header: "API Automated", key: "api", width: 14 },
    { header: "Total Automated", key: "auto", width: 16 },
    { header: "Remaining", key: "remaining", width: 12 },
    { header: "Coverage %", key: "coverage", width: 12 },
  ];
  dashboard.modules.forEach((m) => {
    moduleSheet.addRow({
      name: m.name,
      total: m.current.totalTestCases,
      manual: m.current.manualWritten,
      ui: m.current.uiAutomated,
      api: m.current.apiAutomated,
      auto: m.current.totalAutomated,
      remaining: m.current.remaining,
      coverage: m.current.coverage,
    });
  });

  const teamSheet = workbook.addWorksheet("Team");
  teamSheet.columns = [
    { header: "QA", key: "name", width: 24 },
    { header: "In-Sprint", key: "inSprint", width: 12 },
    { header: "Backlog", key: "backlog", width: 12 },
    { header: "UI", key: "ui", width: 10 },
    { header: "API", key: "api", width: 10 },
    { header: "Total Automated", key: "total", width: 16 },
    { header: "Manual Written", key: "manual", width: 16 },
  ];
  dashboard.team.forEach((t) => {
    teamSheet.addRow({
      name: t.name,
      inSprint: t.inSprintAutomated,
      backlog: t.backlogAutomated,
      ui: t.uiAutomated,
      api: t.apiAutomated,
      total: t.totalAutomated,
      manual: t.manualWritten,
    });
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=connect-qa-report.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

app.get("/api/risks", auth(), (req, res) => {
  const project = req.query.project;
  const rows = getDb().risks || [];
  res.json(project ? rows.filter((r) => (r.project || "Connect") === project) : rows);
});

app.post("/api/risks", auth(), (req, res) => {
  const { title, project, impact, owner, status = "Open", expectedResolution = "" } = req.body || {};
  if (!title) return res.status(400).json({ message: "Risk / blocker is required." });
  const risk = {
    id: uuid(),
    title: String(title).trim(),
    project: project === "Force" ? "Force" : "Connect",
    impact: String(impact || "").trim(),
    owner: String(owner || "").trim(),
    status: ["Open", "In Progress", "Resolved"].includes(status) ? status : "Open",
    expectedResolution: String(expectedResolution || ""),
  };
  saveDb((state) => {
    if (!state.risks) state.risks = [];
    state.risks.push(risk);
    return state;
  });
  res.json(risk);
});

app.put("/api/risks/:id", auth(), (req, res) => {
  const current = (getDb().risks || []).find((r) => r.id === req.params.id);
  if (!current) return res.status(404).json({ message: "Risk not found." });
  let updated;
  saveDb((state) => {
    state.risks = (state.risks || []).map((risk) => {
      if (risk.id !== req.params.id) return risk;
      updated = { ...risk, ...req.body, project: req.body.project === "Force" ? "Force" : risk.project || "Connect" };
      return updated;
    });
    return state;
  });
  res.json(updated);
});

app.delete("/api/risks/:id", auth(["lead", "admin"]), (req, res) => {
  saveDb((state) => {
    state.risks = (state.risks || []).filter((r) => r.id !== req.params.id);
    return state;
  });
  res.json({ ok: true });
});

app.post("/api/seed", auth(["admin"]), (req, res) => {
  const data = seed();
  res.json({ ok: true, users: data.users.length, modules: data.modules.length, updates: data.dailyUpdates.length });
});

function enrichUpdate(row, db) {
  return {
    ...row,
    qaName: db.users.find((u) => u.id === row.userId)?.name,
    moduleName: db.modules.find((m) => m.id === row.moduleId)?.name,
    sprintName: db.sprints.find((s) => s.id === row.sprintId)?.sprintName,
    dailyTotal: Number(row.inSprintAutomated || 0) + Number(row.backlogAutomated || 0),
  };
}

const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Connect QA API running on http://localhost:${PORT}`);
});
