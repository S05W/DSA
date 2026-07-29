import { useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { Navigate } from "react-router";
import { useApp } from "../context/app-context";
import type { ViewRole } from "../models/User";

function LoginPage() {
  const { user, viewRole, login, register } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [requestedViewRole, setRequestedViewRole] = useState<ViewRole>("player");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={viewRole === "master" ? "/meister" : "/"} replace />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (username.trim().length < 3 || password.length < 8) {
      setError("Der Name benötigt mindestens 3 und das Passwort mindestens 8 Zeichen.");
      return;
    }
    try {
      setLoading(true);
      if (mode === "login") await login(username, password, requestedViewRole);
      else await register(username, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-rune">A</div>
        <p className="page-eyebrow">Das Schwarze Auge</p>
        <h1>Dein Heldenbogen.<br />Deine Geschichte.</h1>
        <p>Werte, Talente, Zauber und Ausrüstung bleiben sicher auf deinem DSA-Server gespeichert.</p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <p className="page-eyebrow">Heldenarchiv</p>
          <h2>{mode === "login" ? "Willkommen zurück" : "Profil erstellen"}</h2>
          <p className="login-hint">
            {mode === "login"
              ? "Melde dich an, um dein Heldenarchiv zu öffnen."
              : "In jedem Profil kannst du mehrere Helden verwalten."}
          </p>

          <Form onSubmit={submit}>
            {mode === "login" && <fieldset className="login-role-choice">
              <legend>Anmelden als</legend>
              <button type="button" className={requestedViewRole === "player" ? "selected" : ""} onClick={() => setRequestedViewRole("player")}>
                <strong>Spieler</strong><small>Eigene Helden verwalten</small>
              </button>
              <button type="button" className={requestedViewRole === "master" ? "selected" : ""} onClick={() => setRequestedViewRole("master")}>
                <strong>Meister</strong><small>Sitzung, Karte und Server</small>
              </button>
            </fieldset>}
            <Form.Group className="mb-3" controlId="username">
              <Form.Label>Spielername</Form.Label>
              <Form.Control value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
            </Form.Group>
            <Form.Group className="mb-3" controlId="password">
              <Form.Label>Passwort</Form.Label>
              <Form.Control type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </Form.Group>
            {error && <div className="login-error" role="alert">{error}</div>}
            <Button type="submit" className="dsa-primary-button w-100" disabled={loading}>
              {loading ? "Bitte warten …" : mode === "login" ? "Anmelden" : "Profil erstellen"}
            </Button>
          </Form>

          <button type="button" className="login-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Noch kein Profil? Jetzt erstellen" : "Bereits ein Profil? Zur Anmeldung"}
          </button>
          <small className="local-security-note">{mode === "login" && requestedViewRole === "master" ? "Die Meisteransicht benötigt ein freigeschaltetes Meisterkonto." : "Deine Daten werden zentral auf dem DSA-Server gespeichert."}</small>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
