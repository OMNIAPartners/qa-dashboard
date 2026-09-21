import { Alert, Button, Card, FormControlLabel, Grid, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useEffect, useState } from "react";
import { listUsers, saveConfig, saveModule, saveSprint, saveUser } from "../api/client";
import { useApp } from "../appState";
import { useAuth } from "../auth";
import type { User } from "../types";

export function AdminPage() {
  const { user } = useAuth();
  const { modules, sprints, users, config, refresh } = useApp();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [allUsers, setAllUsers] = useState<User[]>(users);
  const [userForm, setUserForm] = useState({ name: "", email: "", role: "qa", password: "Connect@123" });
  const [moduleForm, setModuleForm] = useState({ name: "", project: "Connect", totalTestCases: 0, manualWritten: 0, uiAutomated: 0, apiRecorded: 0, apiAutomated: 0 });
  const [sprintForm, setSprintForm] = useState({ sprintName: "", project: "Connect", startDate: "", endDate: "", plannedTestCases: 0 });
  const [cfg, setCfg] = useState(config);

  useEffect(() => {
    setAllUsers(users);
    if (config) setCfg(config);
    if (user?.role === "admin" || user?.role === "lead") {
      listUsers().then(setAllUsers).catch(() => undefined);
    }
  }, [users, user?.role, config]);

  async function run(action: () => Promise<unknown>, success: string) {
    setError("");
    try {
      await action();
      setMessage(success);
      await refresh();
      if (user?.role === "admin" || user?.role === "lead") setAllUsers(await listUsers());
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to save.");
    }
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="h4">Administration</Typography>
      {message && <Alert severity="success">{message}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      {user?.role === "admin" || user?.role === "lead" ? (
        <Card sx={{ p: 3 }}>
          <Typography variant="h6">QA names</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Double-click a name to edit it. Changes appear immediately on Daily Update, Team Progress, and all dashboards.
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={4}><TextField fullWidth label="QA name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} /></Grid>
            {user?.role === "admin" && (
              <>
                <Grid item xs={12} md={3}><TextField fullWidth label="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} /></Grid>
                <Grid item xs={12} md={2}>
                  <TextField select fullWidth label="Role" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                    <MenuItem value="qa">QA User</MenuItem>
                    <MenuItem value="lead">QA Lead</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={2}><TextField fullWidth label="Password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} /></Grid>
              </>
            )}
            <Grid item xs={12} md={2}><Button variant="contained" onClick={() => run(() => saveUser({ ...userForm, role: userForm.role as User["role"] }), "QA added.")}>Add QA</Button></Grid>
          </Grid>
          <div style={{ height: 320, marginTop: 16 }}>
            <DataGrid
              rows={allUsers.filter((u) => u.role !== "admin")}
              columns={[
                { field: "name", headerName: "QA Name", flex: 1, minWidth: 180, editable: true },
                { field: "email", headerName: "Email", flex: 1, minWidth: 200, editable: user?.role === "admin" },
                { field: "role", headerName: "Role", width: 120 },
                { field: "active", headerName: "Active", width: 100, type: "boolean", editable: true },
              ]}
              processRowUpdate={async (next, old) => {
                await saveUser({ name: next.name, email: next.email, active: next.active }, next.id);
                await refresh();
                setAllUsers(await listUsers());
                setMessage(`Updated ${old.name} to ${next.name}.`);
                return next;
              }}
              onProcessRowUpdateError={(err) => setError(err?.message || "Unable to update QA name.")}
            />
          </div>
        </Card>
      ) : null}

      <Card sx={{ p: 3 }}>
        <Typography variant="h6">Modules / Baseline</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Daily updates never overwrite these baseline numbers. Only administrators should change locked Connect scope.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}><TextField fullWidth label="Module Name" value={moduleForm.name} onChange={(e) => setModuleForm({ ...moduleForm, name: e.target.value })} /></Grid>
          <Grid item xs={12} md={2}>
            <TextField select fullWidth label="Project" value={moduleForm.project} onChange={(e) => setModuleForm({ ...moduleForm, project: e.target.value })}>
              <MenuItem value="Connect">Connect</MenuItem>
              <MenuItem value="Force">Force</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}><TextField fullWidth type="number" label="Total TC" value={moduleForm.totalTestCases} onChange={(e) => setModuleForm({ ...moduleForm, totalTestCases: Number(e.target.value) })} /></Grid>
          <Grid item xs={6} md={2}><TextField fullWidth type="number" label="Manual" value={moduleForm.manualWritten} onChange={(e) => setModuleForm({ ...moduleForm, manualWritten: Number(e.target.value) })} /></Grid>
          <Grid item xs={6} md={2}><TextField fullWidth type="number" label="UI Automated" value={moduleForm.uiAutomated} onChange={(e) => setModuleForm({ ...moduleForm, uiAutomated: Number(e.target.value) })} /></Grid>
          <Grid item xs={6} md={2}><TextField fullWidth type="number" label="API Rec." value={moduleForm.apiRecorded} onChange={(e) => setModuleForm({ ...moduleForm, apiRecorded: Number(e.target.value) })} /></Grid>
          <Grid item xs={6} md={2}><Button variant="contained" onClick={() => run(() => saveModule({ ...moduleForm, isFeeShare: /feeshare/i.test(moduleForm.name) }), "Module added.")}>Add Module</Button></Grid>
        </Grid>
        <div style={{ height: 380, marginTop: 16 }}>
          <DataGrid
            rows={modules}
            columns={[
              { field: "name", headerName: "Module Name", flex: 1, minWidth: 180, editable: true },
              { field: "project", headerName: "Project", width: 110, editable: true },
              { field: "totalTestCases", headerName: "Total TC", width: 110, editable: true },
              { field: "manualWritten", headerName: "Manual", width: 110, editable: true },
              { field: "uiAutomated", headerName: "UI Baseline", width: 120, editable: true },
              { field: "apiRecorded", headerName: "API Rec.", width: 110, editable: true },
              { field: "apiAutomated", headerName: "API Auto", width: 110, editable: true },
            ]}
            processRowUpdate={async (next) => {
              await saveModule({ ...next, isFeeShare: /feeshare/i.test(String(next.name || "")), baselineChange: true }, next.id);
              await refresh();
              return next;
            }}
          />
        </div>
      </Card>

      <Card sx={{ p: 3 }}>
        <Typography variant="h6">Sprints</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          After a sprint ends, enter the in-sprint automation execution result here or on Sprint Progress.
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={3}><TextField fullWidth label="Sprint name" value={sprintForm.sprintName} onChange={(e) => setSprintForm({ ...sprintForm, sprintName: e.target.value })} /></Grid>
          <Grid item xs={12} md={2}>
            <TextField select fullWidth label="Project" value={sprintForm.project} onChange={(e) => setSprintForm({ ...sprintForm, project: e.target.value })}>
              <MenuItem value="Connect">Connect</MenuItem>
              <MenuItem value="Force">Force</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}><TextField fullWidth type="date" label="Start" InputLabelProps={{ shrink: true }} value={sprintForm.startDate} onChange={(e) => setSprintForm({ ...sprintForm, startDate: e.target.value })} /></Grid>
          <Grid item xs={6} md={2}><TextField fullWidth type="date" label="End" InputLabelProps={{ shrink: true }} value={sprintForm.endDate} onChange={(e) => setSprintForm({ ...sprintForm, endDate: e.target.value })} /></Grid>
          <Grid item xs={6} md={2}><TextField fullWidth type="number" label="Planned TC" value={sprintForm.plannedTestCases} onChange={(e) => setSprintForm({ ...sprintForm, plannedTestCases: Number(e.target.value) })} /></Grid>
          <Grid item xs={6} md={2}><Button variant="contained" onClick={() => run(() => saveSprint(sprintForm), "Sprint added.")}>Add Sprint</Button></Grid>
        </Grid>
        <div style={{ height: 320, marginTop: 16 }}>
          <DataGrid
            rows={sprints}
            columns={[
              { field: "sprintName", headerName: "Sprint", flex: 1, minWidth: 140 },
              { field: "project", headerName: "Project", width: 110, editable: true },
              { field: "startDate", headerName: "Start", width: 120 },
              { field: "endDate", headerName: "End", width: 120 },
              { field: "plannedTestCases", headerName: "Planned TC", width: 120 },
              { field: "inSprintAutoExecuted", headerName: "Auto Executed", width: 130, type: "number", editable: true },
              { field: "inSprintAutoPassed", headerName: "Passed", width: 100, type: "number", editable: true },
              { field: "inSprintAutoFailed", headerName: "Failed", width: 100, type: "number", editable: true },
              { field: "inSprintAutoBlocked", headerName: "Blocked", width: 100, type: "number", editable: true },
            ]}
            processRowUpdate={async (next) => {
              await saveSprint(
                {
                  sprintName: next.sprintName,
                  project: next.project === "Force" ? "Force" : "Connect",
                  startDate: next.startDate,
                  endDate: next.endDate,
                  plannedTestCases: next.plannedTestCases,
                  inSprintAutoExecuted: Number(next.inSprintAutoExecuted || 0),
                  inSprintAutoPassed: Number(next.inSprintAutoPassed || 0),
                  inSprintAutoFailed: Number(next.inSprintAutoFailed || 0),
                  inSprintAutoBlocked: Number(next.inSprintAutoBlocked || 0),
                  inSprintExecutionNotes: next.inSprintExecutionNotes || "",
                },
                next.id
              );
              await refresh();
              return next;
            }}
          />
        </div>
      </Card>

      {cfg && (user?.role === "lead" || user?.role === "admin") && (
        <Card sx={{ p: 3 }}>
          <Typography variant="h6">Weekly highlights (editable, no code change)</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Shown on the executive, Connect, Force, and client views.</Typography>
          <Grid container spacing={2}>
            {(["Connect", "Force"] as const).map((project) => (
              <Grid item xs={12} md={6} key={project}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>{project}</Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="This Week — Highlights"
                  sx={{ mb: 1.5 }}
                  value={cfg.weeklyHighlights?.[project]?.thisWeek || ""}
                  onChange={(e) => setCfg({
                    ...cfg,
                    weeklyHighlights: {
                      Connect: { thisWeek: "", nextWeek: "", attention: "", ...cfg.weeklyHighlights?.Connect },
                      Force: { thisWeek: "", nextWeek: "", attention: "", ...cfg.weeklyHighlights?.Force },
                      [project]: { ...(cfg.weeklyHighlights?.[project] || { thisWeek: "", nextWeek: "", attention: "" }), thisWeek: e.target.value },
                    },
                  })}
                />
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Next Week — Planned"
                  sx={{ mb: 1.5 }}
                  value={cfg.weeklyHighlights?.[project]?.nextWeek || ""}
                  onChange={(e) => setCfg({
                    ...cfg,
                    weeklyHighlights: {
                      Connect: { thisWeek: "", nextWeek: "", attention: "", ...cfg.weeklyHighlights?.Connect },
                      Force: { thisWeek: "", nextWeek: "", attention: "", ...cfg.weeklyHighlights?.Force },
                      [project]: { ...(cfg.weeklyHighlights?.[project] || { thisWeek: "", nextWeek: "", attention: "" }), nextWeek: e.target.value },
                    },
                  })}
                />
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Client Attention Required"
                  value={cfg.weeklyHighlights?.[project]?.attention || ""}
                  onChange={(e) => setCfg({
                    ...cfg,
                    weeklyHighlights: {
                      Connect: { thisWeek: "", nextWeek: "", attention: "", ...cfg.weeklyHighlights?.Connect },
                      Force: { thisWeek: "", nextWeek: "", attention: "", ...cfg.weeklyHighlights?.Force },
                      [project]: { ...(cfg.weeklyHighlights?.[project] || { thisWeek: "", nextWeek: "", attention: "" }), attention: e.target.value },
                    },
                  })}
                />
              </Grid>
            ))}
            <Grid item xs={12}>
              <Button variant="contained" onClick={() => run(() => saveConfig({ weeklyHighlights: cfg.weeklyHighlights, clientAchievements: cfg.clientAchievements, clientFocus: cfg.clientFocus, clientRisks: cfg.clientRisks }), "Weekly highlights saved.")}>
                Save weekly highlights
              </Button>
            </Grid>
          </Grid>
        </Card>
      )}

      {user?.role === "admin" && cfg && (
        <Card sx={{ p: 3 }}>
          <Typography variant="h6">Configuration</Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={4}>
              <TextField select fullWidth label="UI/API counting model" value={cfg.countingMode} onChange={(e) => setCfg({ ...cfg, countingMode: e.target.value as any })}>
                <MenuItem value="unique_test_cases">Unique test cases (do not add UI + API)</MenuItem>
                <MenuItem value="unique_max">Unique max(UI, API)</MenuItem>
                <MenuItem value="separate_assets">Separate assets (UI + API)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}><TextField fullWidth type="number" label="Green ≥" value={cfg.thresholds.green} onChange={(e) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, green: Number(e.target.value) } })} /></Grid>
            <Grid item xs={12} md={2}><TextField fullWidth type="number" label="Amber ≥" value={cfg.thresholds.amber} onChange={(e) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, amber: Number(e.target.value) } })} /></Grid>
            <Grid item xs={12} md={2}><TextField fullWidth type="number" label="Orange ≥" value={cfg.thresholds.orange} onChange={(e) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, orange: Number(e.target.value) } })} /></Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel control={<Switch checked={cfg.allowAutomationExceedScope} onChange={(e) => setCfg({ ...cfg, allowAutomationExceedScope: e.target.checked })} />} label="Allow automation to exceed Total TC" />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel control={<Switch checked={cfg.allowApiExceedRecorded} onChange={(e) => setCfg({ ...cfg, allowApiExceedRecorded: e.target.checked })} />} label="Allow API automated to exceed recorded" />
            </Grid>
            <Grid item xs={12}><TextField fullWidth label="Client achievements" value={cfg.clientAchievements} onChange={(e) => setCfg({ ...cfg, clientAchievements: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Current focus" value={cfg.clientFocus} onChange={(e) => setCfg({ ...cfg, clientFocus: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Risks / dependencies" value={cfg.clientRisks} onChange={(e) => setCfg({ ...cfg, clientRisks: e.target.value })} /></Grid>
            <Grid item xs={12}><Button variant="contained" onClick={() => run(() => saveConfig(cfg as unknown as Record<string, unknown>), "Configuration saved.")}>Save configuration</Button></Grid>
          </Grid>
        </Card>
      )}
    </Stack>
  );
}
