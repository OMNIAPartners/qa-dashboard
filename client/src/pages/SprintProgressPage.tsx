import { Alert, Box, Button, Card, LinearProgress, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { saveSprint } from "../api/client";
import { FilterBar } from "../components/FilterBar";
import { KpiCard } from "../components/KpiCard";
import { StatusBadge } from "../components/StatusBadge";
import { useApp } from "../appState";

const emptyResult = {
  inSprintAutoExecuted: 0,
  inSprintAutoPassed: 0,
  inSprintAutoFailed: 0,
  inSprintAutoBlocked: 0,
  inSprintExecutionNotes: "",
};

export function SprintProgressPage() {
  const { dashboard, filters, setFilters, refresh, users, modules, sprints, loading } = useApp();
  const [selected, setSelected] = useState(dashboard?.config.currentSprintId || "");
  const [result, setResult] = useState(emptyResult);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sprint = dashboard?.sprints.find((s) => s.id === (selected || dashboard.config.currentSprintId)) || dashboard?.sprints[0];

  useEffect(() => {
    if (!sprint) {
      setResult(emptyResult);
      return;
    }
    setResult({
      inSprintAutoExecuted: Number(sprint.inSprintAutoExecuted || 0),
      inSprintAutoPassed: Number(sprint.inSprintAutoPassed || 0),
      inSprintAutoFailed: Number(sprint.inSprintAutoFailed || 0),
      inSprintAutoBlocked: Number(sprint.inSprintAutoBlocked || 0),
      inSprintExecutionNotes: sprint.inSprintExecutionNotes || "",
    });
    setError("");
  }, [sprint?.id, sprint?.inSprintExecutionRecordedAt]);

  if (!dashboard) return <LinearProgress />;

  const sprintClosed = Boolean(sprint?.sprintClosed);
  const hasResult = Boolean(sprint?.inSprintExecutionRecordedAt) || Number(sprint?.inSprintAutoExecuted || 0) > 0;

  const columns: GridColDef[] = [
    { field: "sprintName", headerName: "Sprint", flex: 1, minWidth: 140 },
    { field: "plannedTestCases", headerName: "Total TC", width: 120 },
    { field: "inSprintAutomated", headerName: "In-Sprint Automated", width: 170 },
    { field: "inSprintAutoExecuted", headerName: "Auto Executed", width: 130 },
    { field: "inSprintAutoPassed", headerName: "Passed", width: 100 },
    { field: "inSprintAutoFailed", headerName: "Failed", width: 100 },
    { field: "inSprintAutoBlocked", headerName: "Blocked", width: 100 },
    {
      field: "inSprintExecutionPassPct",
      headerName: "Pass %",
      width: 110,
      valueFormatter: (value) => `${value || 0}%`,
    },
    { field: "backlogAutomated", headerName: "Backlog Automated", width: 160 },
    { field: "remaining", headerName: "Remaining", width: 120 },
    { field: "completion", headerName: "Completion %", width: 130 },
    { field: "status", headerName: "Status", width: 140, renderCell: (p) => <StatusBadge status={p.row.status} /> },
  ];

  async function saveResult() {
    if (!sprint) return;
    const executed = Number(result.inSprintAutoExecuted || 0);
    const passed = Number(result.inSprintAutoPassed || 0);
    const failed = Number(result.inSprintAutoFailed || 0);
    const blocked = Number(result.inSprintAutoBlocked || 0);
    if (passed + failed + blocked !== executed) {
      setError("Passed + Failed + Blocked must equal the in-sprint automation test cases executed.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await saveSprint(
        {
          sprintName: sprint.sprintName,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          plannedTestCases: sprint.plannedTestCases,
          ...result,
        },
        sprint.id
      );
      setMessage("In-sprint automation execution result saved.");
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to save the execution result.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="h4">Sprint Progress</Typography>
      <FilterBar filters={filters} onChange={setFilters} onRefresh={refresh} users={users} modules={modules} sprints={sprints} />
      {loading && <LinearProgress />}
      {dashboard.sprints.length > 0 ? (
        <ToggleButtonGroup exclusive value={sprint?.id || ""} onChange={(_, value) => value && setSelected(value)} sx={{ flexWrap: "wrap" }}>
          {dashboard.sprints.map((s) => (
            <ToggleButton key={s.id} value={s.id}>{s.sprintName}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      ) : (
        <Typography color="text.secondary">No sprints yet. Add a sprint from Daily Update or Administration.</Typography>
      )}
      {sprint && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(6, minmax(0, 1fr))" }, gap: 2 }}>
          <KpiCard color="slate" label="TOTAL TC" value={sprint.plannedTestCases} />
          <KpiCard color="green" label="COMPLETED" value={sprint.totalAutomated || 0} />
          <KpiCard color="orange" label="AUTOMATION %" value={`${sprint.completion || 0}%`} />
          <KpiCard color="purple" label="MANUAL DESIGN %" value={`${sprint.manualPct || 0}%`} />
          <KpiCard color="teal" label="EXECUTION %" value={`${sprint.executionPct || 0}%`} />
          <KpiCard color="rose" label="DEFECTS" value={`${sprint.defectsRaised || 0} / ${sprint.defectsClosed || 0}`} hint="Raised / Closed" />
        </Box>
      )}

      {sprint && (
        <Card sx={{ p: 3 }}>
          <Typography variant="h6">In-sprint automation execution result</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            After {sprint.sprintName} is completed, record how the in-sprint automated test cases executed.
            {sprint.endDate ? ` Sprint end date: ${dayjs(sprint.endDate).format("DD MMM YYYY")}.` : ""}
          </Typography>
          {!sprintClosed && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This sprint is still in progress. You can save the result after the sprint end date, or enter it now if close-out is done.
            </Alert>
          )}
          {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {hasResult && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" }, gap: 2, mb: 2 }}>
              <KpiCard color="blue" label="AUTO EXECUTED" value={sprint.inSprintAutoExecuted || 0} />
              <KpiCard color="green" label="PASSED" value={sprint.inSprintAutoPassed || 0} />
              <KpiCard color="rose" label="FAILED" value={sprint.inSprintAutoFailed || 0} />
              <KpiCard color="orange" label="BLOCKED" value={sprint.inSprintAutoBlocked || 0} />
              <KpiCard color="teal" label="PASS %" value={`${sprint.inSprintExecutionPassPct || 0}%`} />
            </Box>
          )}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
            <TextField
              type="number"
              label="In-sprint auto TCs executed"
              inputProps={{ min: 0 }}
              value={result.inSprintAutoExecuted}
              onChange={(e) => setResult({ ...result, inSprintAutoExecuted: Number(e.target.value || 0) })}
            />
            <TextField
              type="number"
              label="Passed"
              inputProps={{ min: 0 }}
              value={result.inSprintAutoPassed}
              onChange={(e) => setResult({ ...result, inSprintAutoPassed: Number(e.target.value || 0) })}
            />
            <TextField
              type="number"
              label="Failed"
              inputProps={{ min: 0 }}
              value={result.inSprintAutoFailed}
              onChange={(e) => setResult({ ...result, inSprintAutoFailed: Number(e.target.value || 0) })}
            />
            <TextField
              type="number"
              label="Blocked"
              inputProps={{ min: 0 }}
              value={result.inSprintAutoBlocked}
              onChange={(e) => setResult({ ...result, inSprintAutoBlocked: Number(e.target.value || 0) })}
            />
          </Box>
          <TextField
            sx={{ mt: 2 }}
            fullWidth
            multiline
            minRows={2}
            label="Execution notes"
            placeholder="Failures, environment issues, or skipped scripts after sprint close."
            value={result.inSprintExecutionNotes}
            onChange={(e) => setResult({ ...result, inSprintExecutionNotes: e.target.value })}
          />
          <Button sx={{ mt: 2 }} variant="contained" disabled={busy || !sprint} onClick={saveResult}>
            Save execution result
          </Button>
        </Card>
      )}

      <Card sx={{ p: 2 }}>
        <Box sx={{ height: 420 }}>
          <DataGrid rows={dashboard.sprints} columns={columns} onRowClick={(p) => setSelected(p.row.id)} />
        </Box>
      </Card>
    </Stack>
  );
}
