import { Box, Card, LinearProgress, Stack, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FilterBar } from "../components/FilterBar";
import { KpiGrid } from "../components/DashboardWidgets";
import { KpiCard } from "../components/KpiCard";
import { useApp } from "../appState";
import { pctOrNA } from "../projects";

export function AutomationPage() {
  const { dashboard, filters, setFilters, refresh, users, modules, sprints, loading, clientView } = useApp();
  if (!dashboard) return <LinearProgress />;
  const k = dashboard.kpis;
  const sprintRemaining = Math.max(0, Number(dashboard.currentSprint?.plannedTestCases || 0) - k.inSprintAutomated);
  return (
    <Stack spacing={2.5}>
      <Typography variant="h4">Automation</Typography>
      <Typography color="text.secondary">
        Sprint automation and backlog automation are tracked separately. Total Automation = Sprint + Backlog.
        {filters.project ? ` Showing ${filters.project} only.` : " Select Connect or Force to isolate a project."}
      </Typography>
      <FilterBar filters={filters} onChange={setFilters} onRefresh={refresh} users={users} modules={modules} sprints={sprints} hideQa={clientView} />
      {loading && <LinearProgress />}
      <KpiGrid>
        <KpiCard color="green" label="TOTAL AUTOMATED" value={k.totalAutomated} hint={`${k.inSprintAutomated} sprint + ${k.backlogAutomated} backlog`} />
        <KpiCard color="orange" label="AUTOMATION %" value={pctOrNA(k.totalAutomated, k.totalTestCases)} />
        <KpiCard color="blue" label="SPRINT AUTOMATION" value={k.inSprintAutomated} />
        <KpiCard color="orange" label="BACKLOG AUTOMATION" value={k.backlogAutomated} />
        <KpiCard color="slate" label="REMAINING BACKLOG" value={k.remaining} />
        <KpiCard color="teal" label="API AUTOMATION %" value={pctOrNA(k.apiAutomated, k.apiRecorded)} />
      </KpiGrid>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <Card sx={{ p: 2, height: 360 }}>
          <Typography variant="h6">Automation Progress</Typography>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={[
                { name: "Current Sprint", automated: k.inSprintAutomated, remaining: sprintRemaining },
                { name: "Backlog", automated: k.backlogAutomated, remaining: k.remaining },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="automated" name="Automated" stackId="a" fill="#2563eb" />
              <Bar dataKey="remaining" name="Remaining" stackId="a" fill="#cbd5e1" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card sx={{ p: 2, height: 360 }}>
          <Typography variant="h6">Sprint vs Backlog Mix</Typography>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={[{ name: "Sprint Automation", value: k.inSprintAutomated }, { name: "Backlog Automation", value: k.backlogAutomated }]} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
                <Cell fill="#2563eb" />
                <Cell fill="#ea580c" />
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </Box>
      <Card sx={{ p: 2, height: 340 }}>
        <Typography variant="h6">6-Week Automation Trend</Typography>
        <ResponsiveContainer width="100%" height={270}>
          <LineChart data={dashboard.sixWeekTrend || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line dataKey="totalAutomated" name="Total Automated" stroke="#2563eb" strokeWidth={3} />
            <Line dataKey="inSprintAutomated" name="Sprint Automation" stroke="#7c3aed" />
            <Line dataKey="backlogAutomated" name="Backlog Automation" stroke="#ea580c" />
            <Line dataKey="apiAutomated" name="API Automation" stroke="#0d9488" />
            <Line dataKey="manualWritten" name="Manual TC Written" stroke="#334155" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Module Automation</Typography>
        <Box sx={{ height: 360 }}>
          <DataGrid
            rows={dashboard.modules}
            columns={[
              { field: "name", headerName: "Module", flex: 1, minWidth: 180 },
              { field: "totalTestCases", headerName: "Total TC", width: 110, valueGetter: (_v, row) => row.current?.totalTestCases ?? 0 },
              { field: "auto", headerName: "Automated", width: 120, valueGetter: (_v, row) => row.current?.totalAutomated ?? 0 },
              { field: "sprint", headerName: "Sprint", width: 110, valueGetter: (_v, row) => row.current?.inSprintAutomated ?? 0 },
              { field: "backlog", headerName: "Backlog", width: 110, valueGetter: (_v, row) => row.current?.backlogAutomated ?? 0 },
              { field: "automationPct", headerName: "Automation %", width: 140, valueGetter: (_v, row) => row.current?.automationPct || "0%" },
              { field: "remain", headerName: "Remaining", width: 110, valueGetter: (_, r) => r.current?.remaining ?? 0 },
            ]}
          />
        </Box>
      </Card>
    </Stack>
  );
}
