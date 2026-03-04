export function buildPrompt(input) {
  return `You are a healthcare policy operations copilot.

Task: Convert policy text into an execution-ready, compliance-aware action plan.

Hard rules:
1) Return ONLY valid JSON matching the required schema.
2) Do not fabricate legal/regulatory citations not explicitly present in policy_text.
3) If policy is missing key information, list it in missing_information.
4) If policy clauses conflict, include at least one high-severity compliance_flags item with evidence.
5) If uncertainty is high, lower confidence_score accordingly.

Input:
${JSON.stringify(input, null, 2)}

Required JSON schema shape:
{
  "summary": "string",
  "priority_level": "low|medium|high|critical",
  "actions": [{"step":"string","owner_role":"string","due_window":"string","reason":"string"}],
  "compliance_flags": [{"flag":"string","severity":"low|medium|high","evidence":"string"}],
  "missing_information": ["string"],
  "stakeholder_update_draft": "string",
  "confidence_score": 0.0,
  "audit_log": {
    "policy_constraints_detected": ["string"],
    "assumptions_made": ["string"]
  }
}`;
}

export function buildCorrectionPrompt(originalInput, invalidJson, validationIssue) {
  return `The previous model output failed schema validation.

Validation issue summary:
${validationIssue}

Invalid output:
${invalidJson}

Regenerate a corrected response for this same input.
Return ONLY valid JSON and follow the schema exactly.

Original input:
${JSON.stringify(originalInput, null, 2)}`;
}
