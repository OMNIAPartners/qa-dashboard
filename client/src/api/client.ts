import axios from "axios";
import type { DashboardData, DailyUpdate, Filters, User } from "../types";
import { isOfflineMode, offline } from "../offline/api";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("qa-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function filterParams(filters: Filters) {
  const params: Record<string, string> = { preset: filters.preset };
  if (filters.startDate) params.startDate = filters.startDate;
  if (filters.endDate) params.endDate = filters.endDate;
  if (filters.userId) params.userId = filters.userId;
  if (filters.moduleId) params.moduleId = filters.moduleId;
  if (filters.sprintId) params.sprintId = filters.sprintId;
  if (filters.automationType) params.automationType = filters.automationType;
  if (filters.project) params.project = filters.project;
  if (filters.userStory) params.userStory = filters.userStory;
  return params;
}

export async function login(email: string, password: string) {
  if (isOfflineMode()) return offline.login(email, password);
  const { data } = await api.post("/auth/login", { email, password });
  return data as { token: string; user: User };
}

export async function me() {
  if (isOfflineMode()) return offline.me();
  const { data } = await api.get("/auth/me");
  return data.user as User;
}

export async function getMeta() {
  if (isOfflineMode()) return offline.getMeta();
  const { data } = await api.get("/meta");
  return data;
}

export async function getDashboard(filters: Filters) {
  if (isOfflineMode()) return offline.getDashboard(filters) as DashboardData;
  const { data } = await api.get("/dashboard", { params: filterParams(filters) });
  return data as DashboardData;
}

export async function getWeekly(weekStart: string) {
  if (isOfflineMode()) return offline.getWeekly(weekStart);
  const { data } = await api.get("/reports/weekly", { params: { weekStart } });
  return data;
}

export async function getBimonthly(startDate: string, endDate: string) {
  if (isOfflineMode()) return offline.getBimonthly(startDate, endDate);
  const { data } = await api.get("/reports/bimonthly", { params: { startDate, endDate } });
  return data;
}

export async function getModuleDetail(id: string) {
  if (isOfflineMode()) return offline.getModuleDetail(id);
  const { data } = await api.get(`/modules/${id}/detail`);
  return data;
}

export async function listUpdates(params?: Record<string, string>) {
  if (isOfflineMode()) return offline.listUpdates() as DailyUpdate[];
  const { data } = await api.get("/daily-updates", { params });
  return data as DailyUpdate[];
}

export async function lookupUpdate(params: Record<string, string>) {
  if (isOfflineMode()) return offline.lookupUpdate(params) as DailyUpdate | null;
  const { data } = await api.get("/daily-updates/lookup", { params });
  return data.existing as DailyUpdate | null;
}

export async function saveUpdate(payload: Partial<DailyUpdate>, filters: Filters) {
  if (isOfflineMode()) return offline.saveUpdate(payload, filters) as { update: DailyUpdate; dashboard: DashboardData; replaced: boolean };
  const { data } = await api.post("/daily-updates", payload, { params: filterParams(filters) });
  return data as { update: DailyUpdate; dashboard: DashboardData; replaced: boolean };
}

export async function deleteUpdate(id: string) {
  if (isOfflineMode()) return;
  await api.delete(`/daily-updates/${id}`);
}

export async function saveUser(payload: Partial<User> & { password?: string }, id?: string) {
  if (isOfflineMode()) return offline.saveUser(payload, id);
  const { data } = id ? await api.put(`/users/${id}`, payload) : await api.post("/users", payload);
  return data as User;
}

export async function resolveQaName(name: string) {
  if (isOfflineMode()) return offline.resolveQaName(name);
  const { data } = await api.post("/users/resolve", { name });
  return data as User;
}

export async function resolveModule(name: string, project?: string) {
  if (isOfflineMode()) return offline.resolveModule(name, project);
  const { data } = await api.post("/modules/resolve", { name, project });
  return data;
}

export async function resolveSprint(sprintName: string, project?: string) {
  if (isOfflineMode()) return offline.resolveSprint(sprintName, project);
  const { data } = await api.post("/sprints/resolve", { sprintName, project });
  return data;
}

export async function listUsers() {
  if (isOfflineMode()) return offline.listUsers();
  const { data } = await api.get("/users");
  return data as User[];
}

export async function saveModule(payload: Record<string, unknown>, id?: string) {
  if (isOfflineMode()) return offline.saveModule(payload, id);
  const { data } = id ? await api.put(`/modules/${id}`, payload) : await api.post("/modules", payload);
  return data;
}

export async function deleteModule(id: string) {
  if (isOfflineMode()) return offline.deleteModule(id);
  await api.delete(`/modules/${id}`);
}

export async function saveSprint(payload: Record<string, unknown>, id?: string) {
  if (isOfflineMode()) return offline.saveSprint(payload, id);
  const { data } = id ? await api.put(`/sprints/${id}`, payload) : await api.post("/sprints", payload);
  return data;
}

export async function deleteSprint(id: string) {
  if (isOfflineMode()) return offline.deleteSprint(id);
  await api.delete(`/sprints/${id}`);
}

export async function saveConfig(payload: Record<string, unknown>) {
  if (isOfflineMode()) return offline.saveConfig(payload);
  const { data } = await api.put("/config", payload);
  return data;
}

export async function listRisks() {
  if (isOfflineMode()) return offline.listRisks();
  const { data } = await api.get("/risks");
  return data;
}

export async function saveRisk(payload: Record<string, unknown>, id?: string) {
  if (isOfflineMode()) return offline.saveRisk(payload, id);
  const { data } = id ? await api.put(`/risks/${id}`, payload) : await api.post("/risks", payload);
  return data;
}

export async function deleteRisk(id: string) {
  if (isOfflineMode()) return offline.deleteRisk(id);
  await api.delete(`/risks/${id}`);
}

export async function downloadCsv(filters: Filters) {
  if (isOfflineMode()) {
    offline.downloadExcel(filters);
    return;
  }
  const { data } = await api.get("/export/excel", {
    params: filterParams(filters),
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filters.project || "qa"}-weekly-report.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadExcel(filters: Filters) {
  if (isOfflineMode()) {
    offline.downloadExcel(filters);
    return;
  }
  const { data } = await api.get("/export/excel", {
    params: filterParams(filters),
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = "connect-qa-report.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

export default api;
