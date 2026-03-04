import { useMemo, useState } from "react";
import "./App.css";
import { scenarios } from "./scenarios";
import type { ApiError, InputPayload, OutputPayload } from "./types";

const SESSION_LIMIT = 3;
const SESSION_KEY = "policy_copilot_runs";
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function getSessionRuns() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? Number(raw) || 0 : 0;
}

function setSessionRuns(count: number) {
  sessionStorage.setItem(SESSION_KEY, String(count));
}

const initialInput: InputPayload = {
  policy_text: "",
  domain: "healthcare",
  urgency: "medium",
  organization_context: "",
  requester_role: "PM",
};

function priorityLabel(priority: OutputPayload["priority_level"]) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export default function App() {
  const [form, setForm] = useState<InputPayload>(initialInput);
  const [result, setResult] = useState<OutputPayload | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState(getSessionRuns());
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);

  const remainingRuns = useMemo(() => Math.max(0, SESSION_LIMIT - runs), [runs]);

  const loadScenario = (id: string) => {
    const scenario = scenarios.find((s) => s.id === id);
    if (!scenario) return;
    setForm(scenario.input);
    setActiveScenario(id);
    setShowAuditLog(false);
    setError(null);
    setResult(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (runs >= SESSION_LIMIT) {
      setError({
        error_code: "RATE_LIMITED",
        message: "Session run limit reached.",
        details: "Public demo mode allows 3 runs per session.",
      });
      return;
    }

    setLoading(true);
    setShowAuditLog(false);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data as ApiError);
        return;
      }

      setResult(data as OutputPayload);
      const next = runs + 1;
      setRuns(next);
      setSessionRuns(next);
    } catch (err) {
      setError({
        error_code: "MODEL_ERROR",
        message: "Unable to reach backend.",
        details: String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <p className="hero-pill">Healthcare Policy Copilot</p>
        <h1>Paste Any Policy. Get an Audit-Ready Action Plan in Seconds.</h1>
        <p className="hero-subtitle">
          Public demo mode: {SESSION_LIMIT} runs per session. Remaining: {remainingRuns}
        </p>
      </header>

      <section className="scenario-bar" aria-label="Demo scenarios">
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            className={`scenario-pill ${activeScenario === scenario.id ? "active" : ""}`}
            onClick={() => loadScenario(scenario.id)}
          >
            {scenario.label}
          </button>
        ))}
      </section>

      <main className="layout">
        <form className="panel form-panel" onSubmit={onSubmit}>
          <h2 className="panel-title">Input</h2>

          <label>
            <span className="field-label">Policy / SOP Text</span>
            <textarea
              required
              minLength={20}
              value={form.policy_text}
              onChange={(e) => {
                setActiveScenario(null);
                setForm({ ...form, policy_text: e.target.value });
              }}
            />
          </label>

          <label>
            <span className="field-label">Urgency</span>
            <select
              value={form.urgency}
              onChange={(e) => {
                setActiveScenario(null);
                setForm({ ...form, urgency: e.target.value as InputPayload["urgency"] });
              }}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>

          <label>
            <span className="field-label">Organization Context</span>
            <input
              required
              value={form.organization_context}
              onChange={(e) => {
                setActiveScenario(null);
                setForm({ ...form, organization_context: e.target.value });
              }}
            />
          </label>

          <label>
            <span className="field-label">Requester Role</span>
            <select
              value={form.requester_role}
              onChange={(e) => {
                setActiveScenario(null);
                setForm({ ...form, requester_role: e.target.value as InputPayload["requester_role"] });
              }}
            >
              <option>PM</option>
              <option>Operations Manager</option>
              <option>Compliance Lead</option>
              <option>Analyst</option>
            </select>
          </label>

          <button className="submit-btn" type="submit" disabled={loading || remainingRuns <= 0}>
            Generate Action Plan
          </button>
        </form>

        <section className="panel output-panel">
          <h2 className="panel-title">Output</h2>

          {loading && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Generating structured response...</p>
              <div className="skeleton-line long" />
              <div className="skeleton-line" />
              <div className="skeleton-line medium" />
            </div>
          )}

          {!loading && error && (
            <div className="error-block">
              <strong>{error.error_code}</strong>
              <p>{error.message}</p>
              {error.details ? <p className="error-details">{error.details}</p> : null}
            </div>
          )}

          {!loading && !error && !result && (
            <p className="muted">No output yet. Load a scenario or paste policy text and run.</p>
          )}

          {!loading && result && (
            <>
              <div className="summary-banner">{result.summary}</div>

              <div className="metrics-grid">
                <div className="metric-card">
                  <p className="section-label">Priority</p>
                  <span className={`priority-pill priority-${result.priority_level}`}>
                    {priorityLabel(result.priority_level)}
                  </span>
                </div>

                <div className="metric-card">
                  <p className="section-label">Confidence</p>
                  <p className="confidence-value">{Math.round(result.confidence_score * 100)}%</p>
                  <div className="confidence-track" role="progressbar" aria-valuenow={Math.round(result.confidence_score * 100)}>
                    <div className="confidence-fill" style={{ width: `${Math.round(result.confidence_score * 100)}%` }} />
                  </div>
                </div>
              </div>

              <p className="section-label">Actions</p>
              <div className="actions-list">
                {result.actions.map((action, idx) => (
                  <article className="action-card" key={`${action.step}-${idx}`}>
                    <div className="step-index">{idx + 1}</div>
                    <div className="step-content">
                      <p className="step-title">{action.step}</p>
                      <div className="step-tags">
                        <span>{action.owner_role}</span>
                        <span>{action.due_window}</span>
                      </div>
                      <p className="step-reason">{action.reason}</p>
                    </div>
                  </article>
                ))}
              </div>

              <p className="section-label">Compliance Flags</p>
              {result.compliance_flags.length === 0 ? (
                <p className="muted">No compliance flags detected.</p>
              ) : (
                <div className="flag-list">
                  {result.compliance_flags.map((flag, idx) => (
                    <article className={`flag-item severity-${flag.severity}`} key={`${flag.flag}-${idx}`}>
                      <p className="flag-title">{flag.flag}</p>
                      <p>{flag.evidence}</p>
                    </article>
                  ))}
                </div>
              )}

              {result.missing_information.length > 0 && (
                <>
                  <p className="section-label">Missing Information</p>
                  <div className="missing-callout">
                    <ul>
                      {result.missing_information.map((item, idx) => (
                        <li key={`${item}-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              <p className="section-label">Stakeholder Update Draft</p>
              <blockquote className="draft-block">{result.stakeholder_update_draft}</blockquote>

              <button className="audit-toggle" type="button" onClick={() => setShowAuditLog((prev) => !prev)}>
                {showAuditLog ? "Hide Audit Log" : "Show Audit Log"}
              </button>
              {showAuditLog && (
                <div className="audit-log">
                  <pre>{JSON.stringify(result.audit_log, null, 2)}</pre>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
