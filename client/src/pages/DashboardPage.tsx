import { Box, Button, Card, LinearProgress, Stack, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import dayjs from "dayjs";
import { FilterBar } from "../components/FilterBar";
import { HighlightsPanel, ProjectHealthCards } from "../components/DashboardWidgets";
import { KpiCard } from "../components/KpiCard";
import { useApp } from "../appState";
import { pctOrNA } from "../projects";

export function DashboardPage() {
  const { dashboard, filters, setFilters, refresh, users, modules, sprints, loading, clientView } = useApp();
  const navigate = useNavigate();
  if (!dashboard) return <LinearProgress />;

  const connect = dashboard.projectSummaries?.Connect;
  const force = dashboard.projectSummaries?.Force;
  const combined = Boolean(!filters.project);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4">QA Delivery Dashboard</Typography>
        <Typography color="text.secondary">
          {combined ? "Combined landing plus selected-period KPIs. Open Connect or Force for isolated project metrics." : `${filters.project} only — Connect and Force are never mixed.`}
          {" "}
          {dashboard.range.label}: {dayjs(dashboard.range.start).format("DD MMM YYYY")} → {dayjs(dashboard.range.end).format("DD MMM YYYY")}
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <Card sx={{ p: 3, background: "linear-gradient(135deg,#eff6ff,#ffffff)" }}>
          <Typography variant="h5">CONNECT</Typography>
          <Stack spacing={0.6} sx={{ mt: 1.5 }}>
            <Typography>Automation: {pctOrNA(connect?.totalAutomated, connect?.totalTestCases)}</Typography>
            <Typography>Sprint Automation: {connect?.inSprintAutomated ?? 0}</Typography>
            <Typography>Backlog Automation: {connect?.backlogAutomated ?? 0}</Typography>
            <Typography>Execution Pass: {pctOrNA(connect?.passed, connect?.testCasesExecuted)}</Typography>
            <Typography>Open Defects: {connect?.openDefects ?? 0}</Typography>
          </Stack>
          <Button sx={{ mt: 2 }} variant="contained" onClick={() => { setFilters({ ...filters, project: "Connect", moduleId: "", sprintId: "" }); navigate("/connect"); }}>
            View Connect →
          </Button>
        </Card>
        <Card sx={{ p: 3, background: "linear-gradient(135deg,#ecfdf5,#ffffff)" }}>
          <Typography variant="h5">FORCE</Typography>
          <Stack spacing={0.6} sx={{ mt: 1.5 }}>
            <Typography>Automation: {pctOrNA(force?.totalAutomated, force?.totalTestCases)}</Typography>
            <Typography>API Automation: {pctOrNA(force?.apiAutomated, force?.apiRecorded)}</Typography>
            <Typography>Sprint Automation: {force?.inSprintAutomated ?? 0}</Typography>
            <Typography>Backlog Automation: {force?.backlogAutomated ?? 0}</Typography>
            <Typography>Execution Pass: {pctOrNA(force?.passed, force?.testCasesExecuted)}</Typography>
            <Typography>Open Defects: {force?.openDefects ?? 0}</Typography>
          </Stack>
          <Button sx={{ mt: 2 }} variant="contained" color="success" onClick={() => { setFilters({ ...filters, project: "Force", moduleId: "", sprintId: "" }); navigate("/force"); }}>
            View Force →
          </Button>
        </Card>
      </Box>

      <FilterBar filters={filters} onChange={setFilters} onRefresh={refresh} users={users} modules={modules} sprints={sprints} hideQa={clientView} />
      {loading && <LinearProgress />}

      <Typography variant="h5">{combined ? "Executive Dashboard — Combined" : `Executive Dashboard — ${filters.project}`}</Typography>
      <ProjectHealthCards dash={dashboard} combined={combined} />
      <Card sx={{ p: 2 }}>
        <Typography variant="h6">Entries from every QA</Typography>
        <Typography color="text.secondary" sx={{ mb: 1 }}>
          {dashboard.entries?.length || 0} entries are included in the totals. Everyone can see updates saved by the rest of the team.
        </Typography>
        <Box sx={{ height: 360 }}>
          <DataGrid
            rows={dashboard.entries || []}
            columns={[
              { field: "date", headerName: "Date", width: 120 },
              { field: "project", headerName: "Project", width: 110 },
              { field: "qaName", headerName: "QA", width: 160 },
              { field: "moduleName", headerName: "Module", flex: 1, minWidth: 160 },
              { field: "userStory", headerName: "User Story", width: 140 },
              { field: "totalTestCases", headerName: "Total TC", width: 110 },
              { field: "totalAutomated", headerName: "Automated", width: 120 },
              { field: "automationPct", headerName: "Automation %", width: 140 },
            ]}
            disableRowSelectionOnClick
          />
        </Box>
      </Card>
      <HighlightsPanel dash={dashboard} project={filters.project} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" }, gap: 2 }}>
        <Card sx={{ p: 2, height: 360 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Automation Trend</Typography>
          <ResponsiveContainer width="100%" height={290}>
            <LineChart data={dashboard.chartByDate}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(v) => dayjs(v).format("DD MMM")} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="totalAutomated" name="Daily Total" stroke="#2563eb" strokeWidth={3} />
              <Line type="monotone" dataKey="inSprintAutomated" name="Sprint" stroke="#7c3aed" />
              <Line type="monotone" dataKey="backlogAutomated" name="Backlog" stroke="#ea580c" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card sx={{ p: 2, height: 360 }}>
          <Typography variant="h6">Sprint vs Backlog</Typography>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={[
                  { name: "Sprint Automation", value: dashboard.kpis.inSprintAutomated, color: "#2563eb" },
                  { name: "Backlog Automation", value: dashboard.kpis.backlogAutomated, color: "#ea580c" },
                ]}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={90}
              >
                <Cell fill="#2563eb" />
                <Cell fill="#ea580c" />
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </Box>

      <Card sx={{ p: 2, height: 360 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>In-Sprint vs Backlog Automation</Typography>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={[
              { name: "Today", inSprint: dashboard.inSprintVsBacklog.inSprint.today, backlog: dashboard.inSprintVsBacklog.backlog.today },
              { name: "This Week", inSprint: dashboard.inSprintVsBacklog.inSprint.week, backlog: dashboard.inSprintVsBacklog.backlog.week },
              { name: "Current Sprint", inSprint: dashboard.inSprintVsBacklog.inSprint.sprint, backlog: dashboard.inSprintVsBacklog.backlog.sprint },
              { name: "Cumulative", inSprint: dashboard.inSprintVsBacklog.inSprint.cumulative, backlog: dashboard.inSprintVsBacklog.backlog.cumulative },
            ]}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="inSprint" name="Sprint Automation" stackId="a" fill="#2563eb" />
            <Bar dataKey="backlog" name="Backlog Automation" stackId="a" fill="#ea580c" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {!clientView && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
          <KpiCard color="blue" label="SPRINT TODAY" value={dashboard.inSprintVsBacklog.inSprint.today} />
          <KpiCard color="orange" label="BACKLOG TODAY" value={dashboard.inSprintVsBacklog.backlog.today} />
          <KpiCard color="purple" label="SPRINT WEEK" value={dashboard.inSprintVsBacklog.inSprint.week} />
          <KpiCard color="teal" label="BACKLOG WEEK" value={dashboard.inSprintVsBacklog.backlog.week} />
        </Box>
      )}
    </Stack>
  );
}
