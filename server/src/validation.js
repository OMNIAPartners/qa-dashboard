const { WORK_TYPES, NUMERIC_FIELDS } = require("./constants");
const { moduleSnapshot, resolveAutomationTotals, num } = require("./analytics");

function asInt(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function validateDailyPayload(body) {
  const errors = [];
  if (!body.date) errors.push("Date is mandatory.");
  if (!body.project || !["Connect", "Force"].includes(body.project)) errors.push("Project is mandatory.");
  if (!body.userId) errors.push("QA name is mandatory.");
  if (!body.moduleId) errors.push("Module is mandatory.");
  if (!body.sprintId) errors.push("Sprint is mandatory.");
  if (!body.workType) errors.push("Work type is mandatory.");
  if (body.workType && !WORK_TYPES.includes(body.workType)) {
    errors.push("Work type is not valid.");
  }
  if (!body.userStory || !String(body.userStory).trim()) {
    errors.push("User story is mandatory.");
  }

  const numbers = {};
  NUMERIC_FIELDS.forEach((field) => {
    const parsed = asInt(body[field], 0);
    if (Number.isNaN(parsed)) errors.push(`${field} must be a number.`);
    else if (parsed < 0) errors.push("Negative numbers are not allowed.");
    else numbers[field] = parsed;
  });

  if (numbers.passed + numbers.failed + numbers.blocked > numbers.testCasesExecuted) {
    errors.push("Passed + Failed + Blocked cannot exceed test cases executed today.");
  }
  if (
    numbers.criticalDefects + numbers.highDefects + numbers.mediumDefects + numbers.lowDefects >
    numbers.defectsRaised
  ) {
    errors.push("Severity totals cannot exceed defects raised.");
  }

  return { errors, numbers };
}

function validateAgainstBaselines(db, payload, numbers, existingId) {
  const errors = [];
  const config = db.config || {};
  const mod = db.modules.find((m) => m.id === payload.moduleId);
  if (!mod) {
    errors.push("Selected module was not found.");
    return errors;
  }

  const others = db.dailyUpdates.filter(
    (row) => row.moduleId === payload.moduleId && row.id !== existingId
  );
  const snapshot = moduleSnapshot(mod, others, config);
  const nextUi = snapshot.current.uiAutomated + numbers.uiAutomated;
  const nextApi = snapshot.current.apiAutomated + numbers.apiAutomated;
  const nextRecorded = snapshot.current.apiRecorded + numbers.apisRecorded;
  const nextTotal = resolveAutomationTotals({
    uiAutomated: nextUi,
    apiAutomated: nextApi,
    inSprintAutomated: snapshot.current.inSprintAutomated + numbers.inSprintAutomated,
    backlogAutomated: snapshot.current.backlogAutomated + numbers.backlogAutomated,
    manualWritten: snapshot.current.manualWritten + numbers.manualWritten,
    testCasesExecuted: snapshot.current.testCasesExecuted + numbers.testCasesExecuted,
    baselineTotalTestCases: mod.totalTestCases,
    countingMode: config.countingMode,
  }).totalAutomated;

  if (num(mod.totalTestCases) > 0 && !config.allowAutomationExceedScope && nextTotal > num(mod.totalTestCases)) {
    errors.push(
      `Automated test cases cannot exceed Total TC (${mod.totalTestCases}) for ${mod.name}. Remaining room: ${Math.max(0, mod.totalTestCases - snapshot.current.totalAutomated)}.`
    );
  }
  if (nextRecorded > 0 && !config.allowApiExceedRecorded && nextApi > nextRecorded) {
    errors.push("API automated cannot exceed APIs recorded unless an administrator enables that setting.");
  }
  return errors;
}

function uniqueKey(payload) {
  return [
    payload.date,
    payload.project || "Connect",
    payload.userId,
    payload.moduleId,
    String(payload.userStory || "").trim().toLowerCase(),
  ].join("|");
}

module.exports = { validateDailyPayload, validateAgainstBaselines, uniqueKey };
