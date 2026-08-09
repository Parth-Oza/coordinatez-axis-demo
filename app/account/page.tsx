"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";

type AccountUser = { id: string; name: string; email: string; createdAt: string };
type CloudProject = {
  id: string;
  name: string;
  configuration: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

const sizeSlugs = ["10x10", "10x13", "13x13", "13x20"];
const finishSlugs = ["carbon", "cloud", "sand"];

function projectLink(configuration: Record<string, unknown>) {
  const sizeIndex = typeof configuration.sizeIndex === "number" ? configuration.sizeIndex : 1;
  const finishIndex = typeof configuration.finishIndex === "number" ? configuration.finishIndex : 0;
  const walls = configuration.wallSides && typeof configuration.wallSides === "object"
    ? Object.entries(configuration.wallSides as Record<string, unknown>).filter(([, selected]) => selected).map(([side]) => side).join(",")
    : "";
  const query = new URLSearchParams({
    size: sizeSlugs[sizeIndex] ?? sizeSlugs[1],
    finish: finishSlugs[finishIndex] ?? finishSlugs[0],
    walls,
    heater: configuration.heater ? "1" : "0",
    furnished: configuration.furnished === false ? "0" : "1",
    theme: configuration.theme === "desert" ? "desert" : "garden",
    weather: typeof configuration.weather === "string" ? configuration.weather : "clear",
  });
  return `/?${query.toString()}`;
}

function projectDetail(project: CloudProject) {
  const configuration = project.configuration;
  const sizeIndex = typeof configuration.sizeIndex === "number" ? configuration.sizeIndex : 1;
  const finishIndex = typeof configuration.finishIndex === "number" ? configuration.finishIndex : 0;
  const sizes = ["10′ × 10′", "10′ × 13′", "13′ × 13′", "13′ × 20′"];
  const finishes = ["Carbon", "Cloud", "Sand"];
  return `${sizes[sizeIndex] ?? sizes[1]} · ${finishes[finishIndex] ?? finishes[0]}`;
}

export default function AccountPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const loadProjects = useCallback(async () => {
    const response = await fetch("/api/projects", { credentials: "include", cache: "no-store" });
    if (!response.ok) return setProjects([]);
    const result = (await response.json()) as { projects?: CloudProject[] };
    setProjects(result.projects ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { credentials: "include", cache: "no-store" })
      .then((response) => response.json() as Promise<{ user: AccountUser | null }>)
      .then(async (result) => {
        if (!active) return;
        setUser(result.user);
        if (result.user) await loadProjects();
      })
      .catch(() => active && setMessage("The account service is temporarily unavailable."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [loadProjects]);

  const joined = useMemo(() => user ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(user.createdAt)) : "", [user]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { user?: AccountUser; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error || "We could not continue.");
      setUser(result.user);
      setForm({ name: "", email: "", password: "" });
      setMessage(mode === "register" ? "Your Coordinatez account is ready." : "Welcome back.");
      await loadProjects();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not continue.");
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setProjects([]);
    setMessage("You have signed out.");
  };

  const removeProject = async (id: string) => {
    const response = await fetch(`/api/projects/${id}`, { method: "DELETE", credentials: "include" });
    if (response.ok) setProjects((current) => current.filter((project) => project.id !== id));
    else setMessage("That project could not be removed.");
  };

  return (
    <main className="account-page">
      <header className="account-header">
        <Link href="/" className="account-brand">COORDINATEZ<span>®</span></Link>
        <span>PRIVATE PROJECT STUDIO</span>
        <Link href="/">Return to configurator <i>↗</i></Link>
      </header>

      {loading ? (
        <section className="account-loading" aria-live="polite"><i /><span>Opening your project studio</span></section>
      ) : user ? (
        <section className="account-dashboard">
          <aside className="account-profile">
            <span>Coordinatez account</span>
            <div className="account-avatar">{user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div>
            <h1>{user.name}</h1>
            <p>{user.email}</p>
            <dl><div><dt>Member since</dt><dd>{joined}</dd></div><div><dt>Cloud projects</dt><dd>{projects.length}</dd></div><div><dt>Session</dt><dd>Secure · 30 days</dd></div></dl>
            <button onClick={signOut}>Sign out <b>→</b></button>
          </aside>

          <div className="account-projects">
            <div className="account-projects-heading">
              <div><span>Cloud design library</span><h2>Your outdoor rooms.</h2><p>Configurations saved while signed in appear here on every device.</p></div>
              <Link href="/#configure">Create a new design <b>＋</b></Link>
            </div>
            {message && <p className="account-message" role="status">{message}</p>}
            {projects.length ? (
              <div className="account-project-grid">
                {projects.map((project, index) => (
                  <article key={project.id}>
                    <div className={`account-project-art theme-${project.configuration.theme === "desert" ? "desert" : "garden"}`}><i /><i /><i /><i /><span>0{index + 1}</span></div>
                    <div className="account-project-copy"><small>{projectDetail(project)}</small><h3>{project.name}</h3><p>Updated {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(project.updatedAt))}</p></div>
                    <div className="account-project-actions"><Link href={projectLink(project.configuration)}>Open in 3D <b>↗</b></Link><button onClick={() => removeProject(project.id)} aria-label={`Delete ${project.name}`}>Delete</button></div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="account-empty"><i>＋</i><span>No cloud projects yet</span><h3>Build your first AXIS configuration.</h3><p>Choose the footprint, finish, walls, furniture and weather scene, then press “Save design”.</p><Link href="/#configure">Open the 3D studio →</Link></div>
            )}
          </div>
        </section>
      ) : (
        <section className="account-auth-shell">
          <div className="account-auth-story">
            <span>Coordinatez private studio</span>
            <h1>Your outside,<br /><em>kept in one place.</em></h1>
            <p>Save AXIS configurations to the cloud, reopen them from any device, and keep every client-ready concept organized.</p>
            <div><span><b>01</b> Secure account</span><span><b>02</b> Cloud project library</span><span><b>03</b> One-click 3D reopen</span></div>
          </div>
          <div className="account-auth-panel">
            <div className="account-auth-tabs" role="tablist" aria-label="Account access">
              <button className={mode === "login" ? "is-active" : ""} onClick={() => { setMode("login"); setMessage(""); }} role="tab" aria-selected={mode === "login"}>Sign in</button>
              <button className={mode === "register" ? "is-active" : ""} onClick={() => { setMode("register"); setMessage(""); }} role="tab" aria-selected={mode === "register"}>Create account</button>
            </div>
            <form onSubmit={submit}>
              <span>{mode === "login" ? "Welcome back" : "New project account"}</span>
              <h2>{mode === "login" ? "Open your studio." : "Start your studio."}</h2>
              {mode === "register" && <label><span>Full name</span><input required minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" /></label>}
              <label><span>Email address</span><input required type="email" maxLength={180} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label>
              <label><span>Password</span><input required type="password" minLength={10} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={mode === "login" ? "Your password" : "10 characters minimum"} /></label>
              {message && <p className="account-form-message" role="status">{message}</p>}
              <button className="account-submit" type="submit" disabled={submitting}><span>{submitting ? "Please wait…" : mode === "login" ? "Sign in securely" : "Create account"}</span><b>→</b></button>
              <p className="account-security-note">Password protection uses strong one-way encryption. Your secure session lasts for 30 days.</p>
            </form>
          </div>
        </section>
      )}
    </main>
  );
}
