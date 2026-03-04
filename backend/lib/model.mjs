import { GoogleGenAI } from "@google/genai";
export const MODEL_TIMEOUT_MESSAGE = "Model response timed out. Please try again.";

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

function mockResponse(prompt) {
  const input = parseInputFromPrompt(prompt);
  const policyText = String(input?.policy_text || "");

  const hasConflict = /within 30 minutes[\s\S]*within 24 hours/i.test(policyText);
  const missingInfo = /Escalate referral concerns promptly/i.test(policyText);
  const lowConfidence = hasConflict || missingInfo;

  return JSON.stringify({
    summary: lowConfidence
      ? "Potential policy ambiguity detected."
      : "Policy converted into executable workflow actions.",
    priority_level: hasConflict ? "critical" : lowConfidence ? "high" : "medium",
    actions: [
      {
        step: "Assign case owner and initiate triage review",
        owner_role: "Operations Manager",
        due_window: hasConflict ? "Immediately" : "Within stated policy SLA",
        reason: "Ensure accountable ownership and timeline adherence.",
      },
      {
        step: "Document all intervention and communication steps",
        owner_role: "Analyst",
        due_window: "Same business day",
        reason: "Maintain auditability and compliance traceability.",
      },
    ],
    compliance_flags: hasConflict
      ? [
          {
            flag: "Conflicting response timing requirements",
            severity: "high",
            evidence: "Policy states both 30-minute action and 24-hour prerequisite review.",
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

export async function generateWithGemini(prompt) {
  if (process.env.MOCK_MODEL === "1") {
    return mockResponse(prompt);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY.");

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 8000);
  const client = new GoogleGenAI({ apiKey });
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
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const text = response?.text;
  if (!text) throw new Error("Model returned empty response text.");
  return extractJson(text);
}
