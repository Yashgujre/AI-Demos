import { useMemo, useState } from "react";
import "./App.css";
import { scenarios } from "./scenarios";
import type { ApiError, InputPayload, OutputPayload } from "./types";

const SESSION_LIMIT = 3;
const SESSION_KEY = "policy_copilot_runs";
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

let inMemorySessionRuns = 0;

function readSessionRuns(storageKey: string) {
  try {
    const raw = sessionStorage.getItem(storageKey);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return inMemorySessionRuns;
  }
}

function writeSessionRuns(storageKey: string, count: number) {
  try {
    sessionStorage.setItem(storageKey, String(count));
  } catch {
    inMemorySessionRuns = count;
  }
}

function useSessionLimit(limit: number, storageKey: string) {
  const [runs, setRuns] = useState(() => readSessionRuns(storageKey));

  const setRunsSafely = (count: number) => {
    setRuns(count);
    writeSessionRuns(storageKey, count);
  };

  const increment = () => {
    const next = runs + 1;
    setRunsSafely(next);
  };

  const remainingRuns = Math.max(0, limit - runs);

  return {
    runs,
    remainingRuns,
    canRun: runs < limit,
    increment,
  };
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
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const { runs, remainingRuns, canRun, increment } = useSessionLimit(SESSION_LIMIT, SESSION_KEY);

  const scenarioAriaMap = useMemo(
    () => ({
      "high-risk-escalation": "Load scenario 1: high-risk escalation policy sample",
      "routine-update": "Load scenario 2: routine policy update sample",
      "missing-context": "Load scenario 3: incomplete policy context sample",
      "conflicting-clauses": "Load scenario 4: conflicting policy clauses sample",
    }),
    [],
  );

  const loadScenario = (id: string) => {
    const scenario = scenarios.find((s) => s.id === id);
    if (!scenario) return;
    setForm(scenario.input);
    setActiveScenario(id);
    setShowAuditLog(false);
    setCopyState("idle");
    setError(null);
    setResult(null);
  };

  const submitCurrentForm = async () => {
    if (!canRun) {
      setError({
        error_code: "RATE_LIMITED",
        message: "Session run limit reached.",
        details: "Public demo mode allows 3 runs per session.",
      });
      return;
    }

    setLoading(true);
    setShowAuditLog(false);
    setCopyState("idle");
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
      increment();
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCurrentForm();
  };

  const copyErrorDetails = async () => {
    if (!error) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(error, null, 2));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <p className="hero-pill">Healthcare Policy Copilot</p>
        <h1>Paste Any Policy. Get an Audit-Ready Action Plan in Seconds.</h1>
        <p className="hero-subtitle">
          Public demo mode: {SESSION_LIMIT} runs per session. Used: {runs}. Remaining: {remainingRuns}
        </p>
      </header>

      <section className="scenario-bar" aria-label="Demo scenarios">
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            className={`scenario-pill ${activeScenario === scenario.id ? "active" : ""}`}
            aria-label={scenarioAriaMap[scenario.id as keyof typeof scenarioAriaMap] || `Load ${scenario.label}`}
            onClick={() => loadScenario(scenario.id)}
          >
            {scenario.label}
          </button>
        ))}
      </section>

      <main className="layout">
        <form className="panel form-panel" onSubmit={onSubmit}>
          <h2 className="panel-title">Input</h2>

          <label htmlFor="policy-text-input">
            <span className="field-label">Policy / SOP Text</span>
          </label>
          <textarea
            id="policy-text-input"
            required
            minLength={20}
            value={form.policy_text}
            onChange={(e) => {
              setActiveScenario(null);
              setForm({ ...form, policy_text: e.target.value });
            }}
          />

          <label htmlFor="urgency-select">
            <span className="field-label">Urgency</span>
          </label>
          <select
            id="urgency-select"
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

          <label htmlFor="org-context-input">
            <span className="field-label">Organization Context</span>
          </label>
          <input
            id="org-context-input"
            required
            value={form.organization_context}
            onChange={(e) => {
              setActiveScenario(null);
              setForm({ ...form, organization_context: e.target.value });
            }}
          />

          <label htmlFor="requester-role-select">
            <span className="field-label">Requester Role</span>
          </label>
          <select
            id="requester-role-select"
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

          <button className="submit-btn" type="submit" disabled={loading || !canRun}>
            Generate Action Plan
          </button>
        </form>

        <section className="panel output-panel" aria-live="polite" aria-busy={loading ? "true" : "false"}>
          <h2 className="panel-title">Output</h2>

          {loading && (
            <div className="loading-state" aria-label="Generating action plan">
              <div className="skeleton-block large" />
              <div className="skeleton-block medium" />
              <div className="skeleton-block long" />
              <div className="skeleton-block short" />
              <div className="skeleton-block medium" />
            </div>
          )}

          {!loading && error && (
            <div className="error-block" role="alert">
              <strong>{error.error_code}</strong>
              <p>{error.message}</p>
              {error.details ? <p className="error-details">{error.details}</p> : null}
              <div className="error-actions">
                <button className="retry-btn" type="button" onClick={() => void submitCurrentForm()}>
                  Retry
                </button>
                <button className="copy-error-btn" type="button" onClick={() => void copyErrorDetails()}>
                  {copyState === "copied"
                    ? "Copied"
                    : copyState === "failed"
                      ? "Copy failed"
                      : "Copy Error Details"}
                </button>
              </div>
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
                  <div
                    className="confidence-track"
                    role="progressbar"
                    aria-valuenow={Math.round(result.confidence_score * 100)}
                  >
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
