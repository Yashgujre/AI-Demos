import { GoogleGenAI } from "@google/genai";

export const MODEL_TIMEOUT_MESSAGE = "Model response timed out. Please try again.";
export const INVALID_USER_API_KEY_MESSAGE = "Invalid API key provided.";

const startupMode = process.env.MOCK_MODEL === "1" ? "mock" : "live";
const startupModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";

console.log(`[Policy Copilot] Model: ${startupModel}, Mode: ${startupMode}.`);
if (startupMode !== "mock" && !process.env.GEMINI_API_KEY) {
  console.warn(
    "[Policy Copilot] WARNING: MOCK_MODEL is not enabled and GEMINI_API_KEY is not set. Live requests will fail.",
  );
}

function extractJson(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\n([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function parseInputFromPrompt(prompt) {
  const marker = "Input:";
  const idx = prompt.indexOf(marker);
  if (idx < 0) return null;
  const start = prompt.indexOf("{", idx);
  const end = prompt.indexOf("\n\nRequired JSON schema shape:", start);
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(prompt.slice(start, end).trim());
  } catch {
    return null;
  }
}

function hasMockConflict(policyText) {
  const normalized = policyText.toLowerCase();
  const classicConflict = /within\s+30\s+minutes[\s\S]*within\s+24\s+hours/i.test(policyText);
  const immediateWaitConflict = /\bimmediately\b/i.test(policyText)
    && /\b(?:not\s+until|do\s+not\b[^.;]*?\buntil)\b/i.test(policyText);
  const quickDeadlineWaitConflict = /\bwithin\s+\d+\s+minutes\b/i.test(policyText)
    && /\b(?:not\s+until|do\s+not\b[^.;]*?\buntil)\b/i.test(policyText);
  const deadlineBeforeDelayedConflict =
    /\bwithin\s+\d+\s+minutes\b/i.test(policyText)
    && /\bbefore\b[\s\S]*\bwithin\s+\d+\s+(?:hours|days|business\s+days?)\b/i.test(policyText);

  return classicConflict || immediateWaitConflict || quickDeadlineWaitConflict || deadlineBeforeDelayedConflict ||
    // Keep compatibility with normalized wording variations.
    (normalized.includes("immediately") && normalized.includes("do not") && normalized.includes("until"));
}

function hasMissingContextSignals(policyText) {
  const normalized = policyText.toLowerCase();
  const hasExplicitDeadline = /\bwithin\s+\d+\s+(?:minutes?|hours?|days?|business\s+days?)\b/i.test(policyText);
  const hasExplicitOwner =
    /\boperations manager|analyst|compliance lead|clinician|supervisor|coordinator|owner\b/i.test(policyText);
  const hasVagueLanguage =
    /\bquickly|promptly|appropriately|standard rules|right reviewer|as needed|as appropriate\b/i.test(policyText);

  const isVeryShort = normalized.replace(/\s+/g, " ").trim().split(" ").length < 22;

  // Treat text as ambiguous when it relies on vague instructions and lacks explicit ownership/timing signals.
  return hasVagueLanguage && (!hasExplicitDeadline || !hasExplicitOwner || isVeryShort);
}

function firstWindow(text) {
  const match = text.match(/\bwithin\s+\d+\s+(?:minutes?|hours?|days?|business\s+days?)\b/i);
  return match ? match[0] : "Within stated policy SLA";
}

function buildMockActions(policyText, hasConflict, missingInfo) {
  const normalized = policyText.toLowerCase();
  const actions = [];

  if (hasConflict) {
    actions.push({
      step: "Resolve conflicting timing clauses with compliance sign-off",
      owner_role: "Compliance Lead",
      due_window: "Immediately",
      reason: "Contradictory constraints must be reconciled before execution to avoid policy violations.",
    });
  }

  if (/\bself-harm|high-risk|urgent\b/i.test(policyText)) {
    actions.push({
      step: "Initiate clinical escalation and assign incident owner",
      owner_role: "Operations Manager",
      due_window: firstWindow(policyText),
      reason: "High-severity referrals require rapid triage and accountable ownership.",
    });
  }

  if (/\boutreach|contact\b/i.test(policyText)) {
    actions.push({
      step: "Execute outreach workflow and log each attempt",
      owner_role: "Analyst",
      due_window: firstWindow(policyText),
      reason: "Outreach timing and traceability are explicitly required by policy text.",
    });
  }

  if (/\bclinician|specialist|supervis(or|ory)\b/i.test(policyText)) {
    actions.push({
      step: "Coordinate required clinical or supervisory review",
      owner_role: "Compliance Lead",
      due_window: /\bwithin\s+\d+\s+(?:hours?|days?|business\s+days?)\b/i.test(policyText)
        ? firstWindow(policyText)
        : "Before final action handoff",
      reason: "Policy references review/approval checkpoints that gate downstream actions.",
    });
  }

  if (/\bpayer authorization|authorization\b/i.test(policyText)) {
    actions.push({
      step: "Verify authorization status and document outcome before case progression",
      owner_role: "Analyst",
      due_window: "Before outreach execution",
      reason: "Authorization dependency is explicitly stated as a gating condition.",
    });
  }

  if (/\bdocument|care log|crm|tracker|audit\b/i.test(policyText)) {
    actions.push({
      step: "Complete audit-ready documentation in system of record",
      owner_role: "Analyst",
      due_window: /before end of shift/i.test(policyText) ? "Before end of shift" : "Same business day",
      reason: "Policy requires traceable records for compliance and handoff continuity.",
    });
  }

  if (missingInfo) {
    actions.unshift({
      step: "Collect missing policy parameters (owner, SLA, and escalation threshold)",
      owner_role: "Operations Manager",
      due_window: "Before execution",
      reason: "Incomplete policy context introduces execution risk and low-confidence outputs.",
    });
  }

  if (actions.length === 0) {
    actions.push(
      {
        step: "Assign execution owner and create a policy-aligned task checklist",
        owner_role: "Operations Manager",
        due_window: firstWindow(policyText),
        reason: "Owner mapping is required to convert policy language into accountable execution.",
      },
      {
        step: "Capture action evidence and communication logs",
        owner_role: "Analyst",
        due_window: "Same business day",
        reason: "Audit traceability is required for compliance verification.",
      },
    );
  }

  const deduped = [];
  const seen = new Set();
  for (const action of actions) {
    if (seen.has(action.step)) continue;
    seen.add(action.step);
    deduped.push(action);
  }

  return deduped.slice(0, 4);
}

function mockResponse(prompt) {
  const input = parseInputFromPrompt(prompt);
  const policyText = String(input?.policy_text || "");

  const hasConflict = hasMockConflict(policyText);
  const missingInfo = hasMissingContextSignals(policyText);
  const lowConfidence = hasConflict || missingInfo;
  const actions = buildMockActions(policyText, hasConflict, missingInfo);

  return JSON.stringify({
    summary: lowConfidence
      ? "Potential policy ambiguity detected."
      : "Policy converted into executable workflow actions.",
    priority_level: hasConflict ? "critical" : lowConfidence ? "high" : "medium",
    actions,
    compliance_flags: hasConflict
      ? [
          {
            flag: "Conflicting response timing requirements",
            severity: "high",
            evidence: "Policy contains conflicting timing or gating requirements.",
          },
        ]
      : [],
    missing_information: missingInfo ? ["Specific owner role", "Exact response SLA"] : [],
    stakeholder_update_draft:
      "Team has converted the policy into a prioritized action plan with ownership and compliance checks. Risks and missing details are flagged for immediate review.",
    confidence_score: lowConfidence ? 0.52 : 0.78,
    audit_log: {
      policy_constraints_detected: ["Escalation and documentation requirements"],
      assumptions_made: missingInfo ? ["Used standard triage ownership"] : [],
    },
  });
}

function isInvalidApiKeyError(error) {
  const status = Number(error?.status || error?.code || error?.cause?.status || NaN);
  const msg = String(error?.message || "").toLowerCase();
  return (
    status === 401
    || status === 403
    || msg.includes('"code":401')
    || msg.includes('"code":403')
    || msg.includes("unauthorized")
    || msg.includes("forbidden")
    || msg.includes("api key")
    || msg.includes("permission denied")
    || msg.includes("invalid argument")
  );
}

export async function generateWithGemini(prompt, options = {}) {
  if (process.env.MOCK_MODEL === "1") {
    return mockResponse(prompt);
  }

  // Intentionally do not log or persist any user-provided API key.
  const selectedApiKey = options.userApiKey || process.env.GEMINI_API_KEY;
  if (!selectedApiKey) throw new Error("Missing GEMINI_API_KEY.");

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 8000);
  const client = new GoogleGenAI({ apiKey: selectedApiKey });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 1400,
        responseMimeType: "application/json",
      },
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error?.name === "AbortError" || controller.signal.aborted;
    if (aborted) {
      throw new Error(MODEL_TIMEOUT_MESSAGE);
    }
    if (options.userApiKey && isInvalidApiKeyError(error)) {
      const invalidKeyError = new Error(INVALID_USER_API_KEY_MESSAGE);
      invalidKeyError.name = "InvalidUserApiKeyError";
      throw invalidKeyError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const text = response?.text;
  if (!text) throw new Error("Model returned empty response text.");
  return extractJson(text);
}
