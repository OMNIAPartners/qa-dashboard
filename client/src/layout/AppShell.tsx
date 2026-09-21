import {
  Assessment,
  AutoAwesome,
  BugReport,
  CalendarMonth,
  Dashboard,
  Groups,
  Hub,
  Logout,
  PictureAsPdf,
  ReportProblem,
  Settings,
  Speed,
  TableChart,
  Timeline,
  Visibility,
  PrecisionManufacturing,
} from "@mui/icons-material";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { downloadCsv, downloadExcel } from "../api/client";
import { useApp } from "../appState";

const drawerWidth = 268;

const nav = [
  { to: "/", label: "Executive Dashboard", icon: <Dashboard />, roles: ["qa", "lead", "admin"] },
  { to: "/connect", label: "Connect", icon: <Hub />, roles: ["qa", "lead", "admin"] },
  { to: "/force", label: "Force", icon: <PrecisionManufacturing />, roles: ["qa", "lead", "admin"] },
  { to: "/daily", label: "Daily Updates", icon: <CalendarMonth />, roles: ["qa", "lead", "admin"], hideInClient: true },
  { to: "/automation", label: "Automation", icon: <AutoAwesome />, roles: ["qa", "lead", "admin"] },
  { to: "/execution", label: "Test Execution", icon: <Speed />, roles: ["qa", "lead", "admin"] },
  { to: "/defects", label: "Defects", icon: <BugReport />, roles: ["qa", "lead", "admin"] },
  { to: "/risks", label: "Risks & Blockers", icon: <ReportProblem />, roles: ["qa", "lead", "admin"] },
  { to: "/trends", label: "Weekly Trends", icon: <Timeline />, roles: ["qa", "lead", "admin"] },
  { to: "/modules", label: "Module Progress", icon: <Hub />, roles: ["qa", "lead", "admin"], hideInClient: true },
  { to: "/sprints", label: "Sprint Progress", icon: <Speed />, roles: ["qa", "lead", "admin"], hideInClient: true },
  { to: "/team", label: "QA Productivity", icon: <Groups />, roles: ["qa", "lead", "admin"], hideInClient: true },
  { to: "/api-automation", label: "API Automation", icon: <AutoAwesome />, roles: ["qa", "lead", "admin"], hideInClient: true },
  { to: "/ui-automation", label: "UI Automation", icon: <Assessment />, roles: ["qa", "lead", "admin"], hideInClient: true },
  { to: "/reports", label: "Reports", icon: <TableChart />, roles: ["qa", "lead", "admin"] },
  { to: "/client", label: "Client View", icon: <Visibility />, roles: ["qa", "lead", "admin"] },
  { to: "/admin", label: "Administration", icon: <Settings />, roles: ["lead", "admin"], hideInClient: true },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { filters, clientView, setClientView, refresh } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    void refresh();
  }, [location.pathname, refresh]);

  const items = nav.filter((item) => user && item.roles.includes(user.role) && !(clientView && item.hideInClient));

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" elevation={0} sx={{ bgcolor: "#0b1220", borderBottom: "1px solid #1e293b", width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px` }}>
        <Toolbar sx={{ gap: 1.5, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ color: "white", fontWeight: 800 }}>
            QA Delivery Dashboard
          </Typography>
          <Chip size="small" label={filters.project || "All Projects"} sx={{ bgcolor: "#1d4ed8", color: "white" }} />
          <Box flex={1} />
          <Button
            className="no-print"
            color="inherit"
            startIcon={<Visibility />}
            onClick={() => {
              setClientView(!clientView);
              navigate(clientView ? "/" : "/client");
            }}
          >
            {clientView ? "Internal QA View" : "Client View"}
          </Button>
          {(user?.role === "lead" || user?.role === "admin") && (
            <>
              <Button className="no-print" color="inherit" onClick={() => downloadExcel(filters)}>Export Weekly Report</Button>
              <Button className="no-print" color="inherit" onClick={() => downloadExcel(filters)}>Export Excel</Button>
              <Button className="no-print" color="inherit" onClick={() => downloadCsv(filters)}>Export CSV</Button>
            </>
          )}
          <Button className="no-print" color="inherit" startIcon={<PictureAsPdf />} onClick={() => window.print()}>
            Print Client Report
          </Button>
          <Chip label={user?.name} sx={{ bgcolor: "#312e81", color: "white" }} />
          <IconButton className="no-print" color="inherit" onClick={logout}>
            <Logout />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        className="no-print"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            bgcolor: "#111827",
            color: "white",
            borderRight: "1px solid #1f2937",
            pt: 9,
          },
        }}
      >
        <List sx={{ px: 1 }}>
          {items.map((item) => (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              selected={location.pathname === item.to}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                color: "#cbd5e1",
                "&.active, &.Mui-selected": { bgcolor: "#1d4ed8", color: "white" },
              }}
            >
              <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
        <Divider sx={{ borderColor: "#1f2937", my: 1 }} />
        <Box sx={{ px: 2, color: "#94a3b8" }}>
          <Typography variant="caption">Signed in as {user?.role?.toUpperCase()} · {clientView ? "Client View" : "Internal QA View"}</Typography>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, overflowX: "hidden", pt: 11, px: { xs: 2, md: 3 }, pb: 4 }}>
        <Stack spacing={2.5}>
          <Outlet />
        </Stack>
      </Box>
    </Box>
  );
}
