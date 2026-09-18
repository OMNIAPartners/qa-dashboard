import { Alert, Box, Button, Card, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useAuth } from "../auth";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "radial-gradient(circle at top left, #7c3aed 0%, #2563eb 45%, #0f172a 100%)",
        p: 2,
      }}
    >
      <Card sx={{ width: "min(460px, 100%)", p: 4 }}>
        <Typography variant="h5">QA Delivery Dashboard</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          QA reporting for daily updates, automation, execution, and delivery status.
        </Typography>
        <Stack
          component="form"
          spacing={2}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const data = new FormData(form);
            const email = String(data.get("email") || "").trim();
            const password = String(data.get("password") || "").trim();
            setEmail(email);
            setPassword(password);
            setBusy(true);
            setError("");
            try {
              await login(email, password);
            } catch (err: unknown) {
              setError(err && typeof err === "object" && "response" in err ? "Invalid email or password." : "Unable to sign in.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {error && <Alert severity="error">{error}</Alert>}
          <TextField name="email" label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required />
          <TextField name="password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth required />
          <Button type="submit" variant="contained" size="large" disabled={busy}>
            Sign in
          </Button>
          <Typography variant="body2" color="text.secondary">
            Sign in, then add QA names, modules, sprints, and daily progress. Nothing is preloaded.
          </Typography>
        </Stack>
      </Card>
    </Box>
  );
}
