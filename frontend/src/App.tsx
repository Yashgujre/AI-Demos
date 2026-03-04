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

export default function App() {
  const [form, setForm] = useState<InputPayload>(initialInput);
  const [result, setResult] = useState<OutputPayload | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState(getSessionRuns());

  const remainingRuns = useMemo(() => Math.max(0, SESSION_LIMIT - runs), [runs]);

  const loadScenario = (id: string) => {
    const scenario = scenarios.find((s) => s.id === id);
    if (!scenario) return;
    setForm(scenario.input);
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
        <p className="badge">Healthcare Policy Copilot</p>
        <h1>Paste Any Policy. Get an Audit-Ready Action Plan in Seconds.</h1>
        <p>
          Public demo mode: <strong>{SESSION_LIMIT}</strong> runs per session.
          {" "}
          Remaining: <strong>{remainingRuns}</strong>
        </p>
      </header>

      <section className="scenario-bar">
        {scenarios.map((scenario) => (
          <button key={scenario.id} type="button" onClick={() => loadScenario(scenario.id)}>
            {scenario.label}
          </button>
        ))}
      </section>

      <main className="layout">
        <form className="card" onSubmit={onSubmit}>
          <h2>Input</h2>
          <label>
            Policy / SOP Text
            <textarea
              required
              minLength={20}
              value={form.policy_text}
              onChange={(e) => setForm({ ...form, policy_text: e.target.value })}
            />
          </label>

          <label>
            Urgency
            <select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value as InputPayload["urgency"] })}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>

          <label>
            Organization Context
            <input
              required
              value={form.organization_context}
              onChange={(e) => setForm({ ...form, organization_context: e.target.value })}
            />
          </label>

          <label>
            Requester Role
            <select
              value={form.requester_role}
              onChange={(e) => setForm({ ...form, requester_role: e.target.value as InputPayload["requester_role"] })}
            >
              <option>PM</option>
              <option>Operations Manager</option>
              <option>Compliance Lead</option>
              <option>Analyst</option>
            </select>
          </label>

          <button type="submit" disabled={loading || remainingRuns <= 0}>
            {loading ? "Generating..." : "Generate Action Plan"}
          </button>
        </form>

        <section className="card output">
          <h2>Output</h2>

          {error && (
            <div className="error">
              <strong>{error.error_code}</strong>: {error.message}
              {error.details ? <p>{error.details}</p> : null}
            </div>
          )}

          {!error && !result && <p>No output yet. Load a scenario or paste policy text and run.</p>}

          {result && (
            <>
              <p><strong>Summary:</strong> {result.summary}</p>
              <p>
                <strong>Priority:</strong> {result.priority_level} | <strong>Confidence:</strong>{" "}
                {result.confidence_score.toFixed(2)}
              </p>

              <h3>Prioritized Actions</h3>
              <ul>
                {result.actions.map((action, idx) => (
                  <li key={`${action.step}-${idx}`}>
                    <strong>{action.step}</strong> ({action.owner_role}, {action.due_window}) - {action.reason}
                  </li>
                ))}
              </ul>

              <h3>Compliance Flags</h3>
              {result.compliance_flags.length === 0 ? (
                <p>No compliance flags.</p>
              ) : (
                <ul>
                  {result.compliance_flags.map((flag, idx) => (
                    <li key={`${flag.flag}-${idx}`}>
                      <strong>{flag.severity.toUpperCase()}</strong> - {flag.flag}: {flag.evidence}
                    </li>
                  ))}
                </ul>
              )}

              <h3>Missing Information</h3>
              {result.missing_information.length === 0 ? (
                <p>None identified.</p>
              ) : (
                <ul>
                  {result.missing_information.map((item, idx) => (
                    <li key={`${item}-${idx}`}>{item}</li>
                  ))}
                </ul>
              )}

              <h3>Stakeholder Update Draft</h3>
              <p>{result.stakeholder_update_draft}</p>

              <h3>Audit Log</h3>
              <p><strong>Constraints:</strong> {result.audit_log.policy_constraints_detected.join("; ") || "None"}</p>
              <p><strong>Assumptions:</strong> {result.audit_log.assumptions_made.join("; ") || "None"}</p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
