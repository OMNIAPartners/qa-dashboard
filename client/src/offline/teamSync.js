const TOKEN = "359c955b05b88cd96f61d86bf2f7b43c3e6f3dcfef235bf955856eb6a7d6";
const LEGACY_PATH = "Connect-QA-Team-Log-09-21";
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

function same(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function deletedOf(db) {
  const src = db?.deleted || {};
  return Object.fromEntries(BUCKETS.map((key) => [key, [...new Set(src[key] || [])].filter(Boolean).sort()]));
}

function stripUser(user) {
  if (!user) return null;
  const copy = { ...user };
  delete copy.passwordHash;
  if (!copy.password) copy.password = "Connect@123";
  return copy;
}

function ensurePasswords(db) {
  (db.users || []).forEach((user) => {
    if (user && !user.password) user.password = "Connect@123";
  });
}

export function sharedView(db) {
  const view = emptyShared();
  view.users = sortById(db?.users).map(stripUser);
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

async function telegraph(url, options = {}) {
  const response = await fetch(url, { ...options, keepalive: options.method === "POST", signal: AbortSignal.timeout(12000) });
  const body = await response.json();
  if (!response.ok || body.ok === false) throw new Error(body.error || `Team log request failed (${response.status})`);
  return body;
}

async function listPages() {
  const pages = [];
  let offset = 0;
  while (offset < 500) {
    const body = await telegraph(`https://api.telegra.ph/getPageList?access_token=${TOKEN}&limit=50&offset=${offset}`);
    const batch = body.result?.pages || [];
    pages.push(...batch);
    const total = body.result?.total_count || pages.length;
    if (!batch.length || pages.length >= total) break;
    offset += batch.length;
  }
  return pages;
}

async function readPage(path) {
  const response = await fetch(`https://api.telegra.ph/getPage/${path}?return_content=true`, { signal: AbortSignal.timeout(12000) });
  const body = await response.json();
  if (!body.ok) return null;
  const text = textFromContent(body.result?.content);
  if (!text.trim()) return null;
  return JSON.parse(text);
}

function pageBody(data) {
  return JSON.stringify([{ tag: "pre", children: [JSON.stringify(data)] }]);
}

async function createPage(title, data) {
  const form = new URLSearchParams();
  form.set("access_token", TOKEN);
  form.set("title", title);
  form.set("content", pageBody(data));
  await telegraph("https://api.telegra.ph/createPage", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
}

async function editPage(path, title, data) {
  const form = new URLSearchParams();
  form.set("access_token", TOKEN);
  form.set("title", title);
  form.set("content", pageBody(data));
  await telegraph(`https://api.telegra.ph/editPage/${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
}

function assignMissingIds(db) {
  const stampId = (rows, prefix) => {
    (rows || []).forEach((row) => {
      if (row && !row.id) row.id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    });
  };
  stampId(db.users, "user");
  stampId(db.modules, "mod");
  stampId(db.sprints, "sprint");
  stampId(db.dailyUpdates, "du");
  stampId(db.risks, "risk");
}

async function readAllRemote() {
  const [pages, legacy] = await Promise.all([listPages(), readPage(LEGACY_PATH)]);
  const selected = pages.filter((page) => page.title?.startsWith("qauser ") || page.title?.startsWith("qashared "));
  const shards = await Promise.all(selected.map(async (page) => ({ title: page.title, data: await readPage(page.path) })));
  let remote = emptyShared();
  if (legacy && Array.isArray(legacy.dailyUpdates)) remote = mergeTeamDb(remote, legacy);
  shards.forEach(({ title, data }) => {
    if (!data) return;
    if (title.startsWith("qauser ")) {
      remote = mergeTeamDb(remote, {
        users: data.user?.id ? [data.user] : [],
        dailyUpdates: data.updates || [],
      });
      return;
    }
    if (title === "qashared modules") remote = mergeTeamDb(remote, { modules: data.modules || [] });
    if (title === "qashared sprints") remote = mergeTeamDb(remote, { sprints: data.sprints || [] });
    if (title === "qashared risks") remote = mergeTeamDb(remote, { risks: data.risks || [] });
    if (title === "qashared deleted") remote = mergeTeamDb(remote, { deleted: data.deleted || {} });
    if (title === "qashared config") remote = mergeTeamDb(remote, { config: data.config || {} });
  });
  return remote;
}

function unionRows(remoteRows, localRows, bucket) {
  const map = new Map();
  sortById(remoteRows).forEach((row) => map.set(row.id, row));
  sortById(localRows).forEach((row) => map.set(row.id, mergeRow(row, map.get(row.id), bucket)));
  return sortById([...map.values()]);
}

function changedRows(localRows, remoteRows, bucket) {
  const remoteById = new Map(sortById(remoteRows).map((row) => [row.id, row]));
  return sortById(localRows).filter((row) => {
    const prev = remoteById.get(row.id);
    if (!prev) return true;
    if (stamp(row) > stamp(prev)) return true;
    if (bucket === "modules") return MODULE_NUMBERS.some((key) => Number(row[key] || 0) > Number(prev[key] || 0));
    return false;
  });
}

async function upsert(title, produce) {
  const matches = (await listPages()).filter((page) => page.title === title);
  const current = [];
  for (const page of matches) {
    const parsed = await readPage(page.path);
    if (parsed) current.push(parsed);
  }
  const next = produce(current);
  if (matches.length === 1 && same(current[0], next)) return;
  if (!matches.length) {
    await createPage(title, next);
    return;
  }
  for (const page of matches) await editPage(page.path, title, next);
}

async function pushLocalChanges(local, remote) {
  const remoteUpdates = new Map(sortById(remote.dailyUpdates).map((row) => [row.id, row]));
  const userIds = [...new Set([...(local.users || []).map((user) => user.id), ...(local.dailyUpdates || []).map((row) => row.userId)].filter(Boolean))];
  for (const userId of userIds) {
    const mine = (local.dailyUpdates || []).filter((row) => row.userId === userId);
    const user = (local.users || []).find((item) => item.id === userId);
    const remoteUser = (remote.users || []).find((item) => item.id === userId);
    const sharedUser = stripUser(user);
    const updatesChanged = mine.some((row) => {
      const prev = remoteUpdates.get(row.id);
      return !prev || stamp(row) > stamp(prev);
    });
    const userChanged = Boolean(sharedUser) && (!remoteUser || sharedUser.name !== remoteUser.name || sharedUser.active !== remoteUser.active || sharedUser.role !== remoteUser.role || sharedUser.password !== remoteUser.password);
    if (!updatesChanged && !userChanged) continue;
    await upsert(`qauser ${userId}`, (parts) => {
      const existing = parts.map((part) => part.user).find((item) => item?.id) || null;
      const nextUser = sharedUser || stripUser(existing);
      if (nextUser && existing?.password && !user?.password) nextUser.password = existing.password;
      return {
        user: nextUser,
        updates: unionRows(parts.flatMap((part) => part.updates || []), mine, "dailyUpdates"),
      };
    });
  }

  const collections = [
    ["qashared modules", "modules", local.modules, remote.modules],
    ["qashared sprints", "sprints", local.sprints, remote.sprints],
    ["qashared risks", "risks", local.risks, remote.risks],
  ];
  for (const [title, bucket, localRows, remoteRows] of collections) {
    if (!changedRows(localRows, remoteRows, bucket).length) continue;
    await upsert(title, (parts) => ({
      [bucket]: unionRows(parts.flatMap((part) => part[bucket] || []), localRows, bucket),
    }));
  }

  const remoteDeleted = deletedOf(remote);
  const localDeleted = deletedOf(local);
  const deletedChanged = BUCKETS.some((key) => (localDeleted[key] || []).some((id) => !(remoteDeleted[key] || []).includes(id)));
  if (deletedChanged) {
    await upsert("qashared deleted", (parts) => {
      const deleted = emptyShared().deleted;
      [...parts.map((part) => deletedOf(part)), localDeleted].forEach((source) => {
        BUCKETS.forEach((key) => {
          deleted[key] = [...new Set([...deleted[key], ...(source[key] || [])])].sort();
        });
      });
      return { deleted };
    });
  }

  const localConfig = local.config || {};
  const remoteConfig = remote.config || {};
  if ((Date.parse(localConfig.updatedAt || "") || 0) > (Date.parse(remoteConfig.updatedAt || "") || 0)) {
    await upsert("qashared config", () => ({ config: localConfig }));
  }
}

export async function syncTeamDb(getLocal, options = {}) {
  const remote = await readAllRemote();
  const local = getLocal();
  assignMissingIds(local);
  ensurePasswords(local);
  const merged = mergeTeamDb(local, remote);
  ensurePasswords(merged);
  let confirmed = remote;
  try {
    await pushLocalChanges(merged, remote);
    confirmed = await readAllRemote();
  } catch (error) {
    if (options.mustSave) throw error;
  }
  const result = mergeTeamDb(merged, confirmed);
  ensurePasswords(result);
  return result;
}

export async function pullTeamDb() {
  return readAllRemote();
}
