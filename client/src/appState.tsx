import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { getDashboard, getMeta } from "./api/client";
import type { AppConfig, DashboardData, Filters, Module, Sprint, User } from "./types";

dayjs.extend(isoWeek);

interface AppModel {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  dashboard: DashboardData | null;
  users: User[];
  modules: Module[];
  sprints: Sprint[];
  workTypes: string[];
  config: AppConfig | null;
  refresh: (silent?: boolean) => Promise<void>;
  applyDashboard: (dash: DashboardData) => void;
  loading: boolean;
  clientView: boolean;
  setClientView: (value: boolean) => void;
}

const Ctx = createContext<AppModel | null>(null);

const defaultFilters = (): Filters => ({
  preset: "this_week",
  startDate: dayjs().startOf("isoWeek").format("YYYY-MM-DD"),
  endDate: dayjs().endOf("isoWeek").format("YYYY-MM-DD"),
  userId: "",
  moduleId: "",
  sprintId: "",
  automationType: "",
  project: "",
  userStory: "",
});

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [clientView, setClientView] = useState(false);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [meta, dash] = await Promise.all([getMeta(), getDashboard(filters)]);
      setUsers(meta.users);
      setModules(meta.modules);
      setSprints(meta.sprints);
      setWorkTypes(meta.workTypes);
      setConfig(meta.config);
      setDashboard(dash);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters]);

  const applyDashboard = useCallback((dash: DashboardData) => {
    setDashboard(dash);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 15000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      dashboard,
      users,
      modules,
      sprints,
      workTypes,
      config,
      refresh,
      applyDashboard,
      loading,
      clientView,
      setClientView,
    }),
    [filters, dashboard, users, modules, sprints, workTypes, config, refresh, applyDashboard, loading, clientView]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AppStateProvider missing");
  return ctx;
}
