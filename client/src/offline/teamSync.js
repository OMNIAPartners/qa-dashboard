const PAGE = "Connect-QA-Team-Log-09-21";
const TOKEN = "359c955b05b88cd96f61d86bf2f7b43c3e6f3dcfef235bf955856eb6a7d6";
const BUCKETS = ["users", "modules", "sprints", "dailyUpdates", "risks"];
const MODULE_NUMBERS = ["totalTestCases", "manualWritten", "uiAutomated", "apiRecorded", "apiAutomated"];

function emptyShared() {
  return {
    users: [],
    modules: [],
    sprints: [],
    dailyUpdates: [],
    risks: [],
    config: {},
    deleted: Object.fromEntries(BUCKETS.map((key) => [key, []])),
  };
}

function textFromContent(nodes) {
  const parts = [];
  const walk = (node) => {
    if (typeof node === "string") parts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") walk(node.children);
  };
  walk(nodes);
  return parts.join("");
}

function stamp(row) {
  return Date.parse(row?.updatedAt || row?.createdAt || "") || 0;
}

function sortById(rows) {
  return [...(rows || [])].filter((row) => row && row.id).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        if (value[key] !== undefined) acc[key] = stable(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function deletedOf(db) {
  const src = db?.deleted || {};
  return Object.fromEntries(BUCKETS.map((key) => [key, [...new Set(src[key] || [])].filter(Boolean).sort()]));
}

export function sharedView(db) {
  const view = emptyShared();
  view.users = sortById(db?.users).map((user) => {
    const copy = { ...user };
    delete copy.password;
    delete copy.passwordHash;
    return copy;
  });
  view.modules = sortById(db?.modules);
  view.sprints = sortById(db?.sprints);
  view.dailyUpdates = sortById(db?.dailyUpdates);
  view.risks = sortById(db?.risks);
  view.config = { ...(db?.config || {}) };
  view.deleted = deletedOf(db);
  return view;
}

function mergeRow(localRow, remoteRow, bucket) {
  if (!localRow) return remoteRow;
  if (!remoteRow) return localRow;
  const preferLocal = stamp(localRow) >= stamp(remoteRow);
  const merged = preferLocal ? { ...remoteRow, ...localRow } : { ...localRow, ...remoteRow };
  if (bucket === "users") {
    const password = localRow.password || remoteRow.password;
    if (password) merged.password = password;
    else delete merged.password;
    delete merged.passwordHash;
  }
  if (bucket === "modules") {
    MODULE_NUMBERS.forEach((key) => {
      merged[key] = Math.max(Number(localRow[key] || 0), Number(remoteRow[key] || 0));
    });
  }
  return merged;
}

export function mergeTeamDb(local, remote) {
  const localDeleted = deletedOf(local);
  const remoteDeleted = deletedOf(remote);
  const deleted = Object.fromEntries(
    BUCKETS.map((key) => [key, [...new Set([...(localDeleted[key] || []), ...(remoteDeleted[key] || [])])].sort()])
  );
  const merged = { ...local, deleted };
  BUCKETS.forEach((key) => {
    const map = new Map();
    sortById(remote?.[key]).forEach((row) => map.set(row.id, row));
    sortById(local?.[key]).forEach((row) => map.set(row.id, mergeRow(row, map.get(row.id), key)));
    const gone = new Set(deleted[key]);
    merged[key] = sortById([...map.values()]).filter((row) => !gone.has(row.id));
  });
  const localConfig = local?.config || {};
  const remoteConfig = remote?.config || {};
  const localStamp = Date.parse(localConfig.updatedAt || "") || 0;
  const remoteStamp = Date.parse(remoteConfig.updatedAt || "") || 0;
  merged.config = localStamp >= remoteStamp ? { ...remoteConfig, ...localConfig } : { ...localConfig, ...remoteConfig };
  merged.auditLogs = local?.auditLogs || [];
  return merged;
}

async function request(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  const body = await response.json();
  if (!response.ok || body.ok === false) throw new Error(body.error || `Team log request failed (${response.status})`);
  return body;
}

export async function pullTeamDb() {
  const body = await request(`https://api.telegra.ph/getPage/${PAGE}?return_content=true`);
  const text = textFromContent(body.result?.content);
  if (!text.trim()) return emptyShared();
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.dailyUpdates)) throw new Error("Team log payload was not readable.");
  return parsed;
}

export async function pushTeamDb(view) {
  const form = new URLSearchParams();
  form.set("access_token", TOKEN);
  form.set("title", "Connect QA Team Log");
  form.set("content", JSON.stringify([{ tag: "pre", children: [JSON.stringify(view)] }]));
  await request(`https://api.telegra.ph/editPage/${PAGE}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
}

export async function syncTeamDb(getLocal) {
  const remote = await pullTeamDb();
  let merged = mergeTeamDb(getLocal(), remote);
  const view = sharedView(merged);
  if (JSON.stringify(stable(view)) !== JSON.stringify(stable(sharedView(remote)))) {
    await pushTeamDb(view);
    merged = mergeTeamDb(getLocal(), merged);
  }
  return merged;
}
