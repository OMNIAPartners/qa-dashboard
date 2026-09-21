import { Alert, Box, Card, LinearProgress, Stack, TextField, Typography } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useState } from "react";
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
import { FilterBar } from "../components/FilterBar";
import { FlowSteps, HighlightsPanel, KpiGrid, Meter } from "../components/DashboardWidgets";
import { KpiCard } from "../components/KpiCard";
import { useApp } from "../appState";
import { useLockedProject } from "../hooks/useLockedProject";
import { pctOrNA } from "../projects";
import type { ProjectName } from "../types";

export function ProjectDashboardPage({ project }: { project: ProjectName }) {
  useLockedProject(project);
  const { dashboard, filters, setFilters, refresh, users, modules, sprints, loading, clientView } = useApp();
  const [storyQuery, setStoryQuery] = useState("");
  if (!dashboard) return <LinearProgress />;

  const k = dashboard.kpis;
  const sprint = dashboard.currentSprint;
  const stories = (dashboard.stories || []).filter((s) => !storyQuery || `${s.moduleName} ${s.userStory}`.toLowerCase().includes(storyQuery.toLowerCase()));
  const isForce = project === "Force";
  const fee = dashboard.feeShare;

  const moduleColumns: GridColDef[] = [
    { field: "name", headerName: isForce ? "Module" : "Module / User Story", flex: 1.4, minWidth: 180 },
    { field: "total", headerName: "Total TC", width: 100, valueGetter: (_, r) => r.current.totalTestCases },
    { field: "manual", headerName: "Manual", width: 100, valueGetter: (_, r) => r.current.manualWritten },
    { field: "auto", headerName: "Automated", width: 110, valueGetter: (_, r) => r.current.totalAutomated },
    { field: "pct", headerName: "Automation %", width: 130, valueGetter: (_, r) => pctOrNA(r.current.totalAutomated, r.current.totalTestCases) },
    ...(!isForce ? [{ field: "progress", headerName: "In Progress", width: 120, valueGetter: () => "N/A" } as GridColDef] : []),
    { field: "remaining", headerName: "Remaining", width: 110, valueGetter: (_, r) => r.current.remaining },
  ];

  const storyColumns: GridColDef[] = [
    { field: "moduleName", headerName: "Module", flex: 1, minWidth: 140 },
    { field: "userStory", headerName: "User Story", flex: 1, minWidth: 140 },
    { field: "totalTestCases", headerName: "Total TC", width: 100 },
    { field: "manualWritten", headerName: "Manual", width: 100 },
    { field: "totalAutomated", headerName: "Automated", width: 110 },
    { field: "pct", headerName: "Automation %", width: 130, valueGetter: (_, r) => pctOrNA(r.totalAutomated, r.totalTestCases) },
    { field: "progress", headerName: "In Progress", width: 120, valueGetter: () => "N/A" },
    { field: "remaining", headerName: "Remaining", width: 110, valueGetter: (_, r) => (r.remaining == null ? "N/A" : r.remaining) },
  ];

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4">{project} Dashboard</Typography>
        <Typography color="text.secondary">
          Isolated {project} metrics only. Filters, KPIs, and charts never include the other project.
        </Typography>
      </Box>
      <FilterBar filters={filters} onChange={setFilters} onRefresh={refresh} users={users} modules={modules} sprints={sprints} hideQa={clientView} />
      {loading && <LinearProgress />}

      <KpiGrid>
        <KpiCard color="slate" label="TOTAL TEST CASES" value={k.totalTestCases} />
        <KpiCard color="purple" label="MANUAL TEST CASES WRITTEN" value={k.manualWritten} />
        <KpiCard color="green" label="TOTAL AUTOMATED" value={k.totalAutomated} hint={`Sprint ${k.inSprintAutomated} + Backlog ${k.backlogAutomated}`} />
        <KpiCard color="orange" label="AUTOMATION %" value={pctOrNA(k.totalAutomated, k.totalTestCases)} />
        <KpiCard color="blue" label="SPRINT AUTOMATION" value={k.inSprintAutomated} />
        <KpiCard color="orange" label="BACKLOG AUTOMATION" value={k.backlogAutomated} />
        <KpiCard color="teal" label="APIS RECORDED" value={k.apiRecorded} />
        <KpiCard color="teal" label="APIS AUTOMATED" value={k.apiAutomated} hint={isForce ? `API ${pctOrNA(k.apiAutomated, k.apiRecorded)}` : undefined} />
        {isForce && <KpiCard color="green" label="API AUTOMATION %" value={pctOrNA(k.apiAutomated, k.apiRecorded)} />}
        <KpiCard color="blue" label="TESTS EXECUTED" value={k.testCasesExecuted ?? 0} />
        <KpiCard color="green" label="PASSED" value={k.passed ?? 0} />
        <KpiCard color="rose" label="FAILED" value={k.failed ?? 0} />
        <KpiCard color="orange" label="BLOCKED" value={k.blocked ?? 0} />
        <KpiCard color="rose" label="OPEN DEFECTS" value={k.openDefects ?? 0} />
        <KpiCard color="slate" label="CLOSED DEFECTS" value={dashboard.defects?.closed ?? 0} />
      </KpiGrid>

      <Card sx={{ p: 2.5 }}>
        <Typography variant="h6">{project} Sprint Progress</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Current Sprint: {sprint?.sprintName || "N/A"} · Planned TC: {sprint?.plannedTestCases ?? "N/A"}
        </Typography>
        <FlowSteps
          steps={[
            { label: "Sprint Test Cases", value: sprint?.plannedTestCases ?? "N/A" },
            { label: "Manual Design", value: sprint?.manualWritten ?? 0 },
            { label: "Automation", value: (sprint?.inSprintAutomated || 0) + (sprint?.backlogAutomated || 0) },
            { label: "Execution", value: sprint?.testCasesExecuted ?? 0 },
            { label: "Passed", value: sprint?.passed ?? 0 },
          ]}
        />
      </Card>

      {isForce && (
        <Card sx={{ p: 2.5 }}>
          <Typography variant="h6">Force API Coverage</Typography>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Meter label="APIs Recorded" value={k.apiRecorded} total={k.apiRecorded} />
            <Meter label="APIs Automated" value={k.apiAutomated} total={k.apiRecorded} />
            <Typography>API Automation Remaining: {k.apiRecorded ? Math.max(0, k.apiRecorded - k.apiAutomated) : "N/A"}</Typography>
            <Typography variant="caption" color="text.secondary">
              API Automation % = Automated APIs / Total APIs Recorded × 100
            </Typography>
          </Stack>
        </Card>
      )}

      {isForce && (
        <Card sx={{ p: 2.5 }}>
          <Typography variant="h6">Force Test Case Automation</Typography>
          <FlowSteps
            steps={[
              { label: "Total Force Test Cases", value: k.totalTestCases },
              { label: "Manual Test Cases", value: k.manualWritten },
              { label: "Automated Test Cases", value: k.totalAutomated },
              { label: "Executed", value: k.testCasesExecuted ?? 0 },
              { label: "Passed / Failed / Blocked", value: `${k.passed ?? 0} / ${k.failed ?? 0} / ${k.blocked ?? 0}` },
            ]}
          />
        </Card>
      )}

      {isForce && (
        <Card sx={{ p: 2.5 }}>
          <Typography variant="h6">Force FeeShare</Typography>
          {!fee ? (
            <Alert severity="info" sx={{ mt: 1 }}>Not Available — add a Force module named FeeShare in Administration or Daily Update.</Alert>
          ) : (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <KpiGrid>
                <KpiCard color="slate" label="FEESHARE TEST CASES" value={fee.totalTestCases} />
                <KpiCard color="purple" label="MANUAL" value={fee.manualWritten} />
                <KpiCard color="green" label="AUTOMATED" value={fee.totalAutomated} hint={pctOrNA(fee.totalAutomated, fee.totalTestCases)} />
                <KpiCard color="teal" label="APIS RECORDED" value={fee.apiRecorded} />
                <KpiCard color="teal" label="APIS AUTOMATED" value={fee.apiAutomated} />
                <KpiCard color="orange" label="REMAINING AUTOMATION" value={fee.remaining ?? 0} />
                <KpiCard color="blue" label="EXECUTED" value={fee.testCasesExecuted ?? 0} />
                <KpiCard color="green" label="PASSED" value={fee.passed ?? 0} />
                <KpiCard color="rose" label="FAILED" value={fee.failed ?? 0} />
                <KpiCard color="orange" label="BLOCKED" value={fee.blocked ?? 0} />
              </KpiGrid>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={fee.weekly || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line dataKey="totalAutomated" name="Automated" stroke="#2563eb" />
                    <Line dataKey="apiAutomated" name="API Automated" stroke="#0d9488" />
                    <Line dataKey="manualWritten" name="Manual TC" stroke="#7c3aed" />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Stack>
          )}
        </Card>
      )}

      <Card sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="h6">{project} Module Breakdown</Typography>
          <TextField size="small" label="Filter module / story" value={storyQuery} onChange={(e) => setStoryQuery(e.target.value)} sx={{ minWidth: 240 }} />
        </Stack>
        <Box sx={{ height: 360 }}>
          <DataGrid
            rows={dashboard.modules.filter((m) => !storyQuery || m.name.toLowerCase().includes(storyQuery.toLowerCase()))}
            columns={moduleColumns}
            disableRowSelectionOnClick
          />
        </Box>
      </Card>

      {!isForce && (
        <Card sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Connect Module / User Story Activity</Typography>
          <Box sx={{ height: 320 }}>
            <DataGrid rows={stories} columns={storyColumns} disableRowSelectionOnClick />
          </Box>
        </Card>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <Card sx={{ p: 2, height: 360 }}>
          <Typography variant="h6">Sprint vs Backlog Automation</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Total Automation = Sprint Automation + Backlog Automation ({k.inSprintAutomated} + {k.backlogAutomated} = {k.inSprintAutomated + k.backlogAutomated})
          </Typography>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={[
                { name: "Current Sprint", automated: k.inSprintAutomated, remaining: Math.max(0, (sprint?.plannedTestCases || 0) - k.inSprintAutomated) },
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
          <Typography variant="h6">{project} Execution Health</Typography>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={[
                  { name: "Passed", value: dashboard.execution?.passed || 0, color: "#059669" },
                  { name: "Failed", value: dashboard.execution?.failed || 0, color: "#e11d48" },
                  { name: "Blocked", value: dashboard.execution?.blocked || 0, color: "#ea580c" },
                  { name: "Not Executed", value: dashboard.execution?.notExecuted || 0, color: "#94a3b8" },
                  { name: "Flaky", value: dashboard.execution?.flaky || 0, color: "#7c3aed" },
                ]}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={85}
              >
                <Cell fill="#059669" />
                <Cell fill="#e11d48" />
                <Cell fill="#ea580c" />
                <Cell fill="#94a3b8" />
                <Cell fill="#7c3aed" />
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </Box>

      <Card sx={{ p: 2, height: 340 }}>
        <Typography variant="h6">Execution Results Trend</Typography>
        <ResponsiveContainer width="100%" height={270}>
          <LineChart data={dashboard.chartByDate}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line dataKey="passed" name="Passed" stroke="#059669" />
            <Line dataKey="failed" name="Failed" stroke="#e11d48" />
            <Line dataKey="blocked" name="Blocked" stroke="#ea580c" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>{project} Defects</Typography>
        <KpiGrid>
          <KpiCard color="blue" label="NEW THIS WEEK" value={dashboard.defects?.newThisWeek ?? 0} />
          <KpiCard color="orange" label="OPEN" value={dashboard.defects?.open ?? 0} />
          <KpiCard color="purple" label="IN PROGRESS" value="N/A" hint="Status workflow not tracked yet" />
          <KpiCard color="green" label="FIXED / CLOSED" value={dashboard.defects?.closed ?? 0} />
          <KpiCard color="rose" label="REOPENED" value={dashboard.defects?.reopened ?? 0} />
          <KpiCard color="rose" label="CRITICAL" value={dashboard.defects?.critical ?? 0} />
          <KpiCard color="orange" label="HIGH" value={dashboard.defects?.high ?? 0} />
          <KpiCard color="teal" label="MEDIUM" value={dashboard.defects?.medium ?? 0} />
          <KpiCard color="slate" label="LOW" value={dashboard.defects?.low ?? 0} />
        </KpiGrid>
      </Card>

      <HighlightsPanel dash={dashboard} project={project} />
    </Stack>
  );
}
