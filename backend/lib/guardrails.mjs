function hasConflictSignals(text) {
  const normalized = text.toLowerCase();
  return (
    (normalized.includes("within 30 minutes") && normalized.includes("within 24 hours")) ||
    (normalized.includes("immediately") && normalized.includes("do not") && normalized.includes("until"))
  );
}

function hasMissingCriticalSignals(output) {
  const actionDueMissing = output.actions.some((a) => !a.due_window || a.due_window.length < 2);
  const ownerMissing = output.actions.some((a) => !a.owner_role || a.owner_role.length < 2);
  return actionDueMissing || ownerMissing;
}

export function applyGuardrails(input, output) {
  const next = structuredClone(output);

  if (hasConflictSignals(input.policy_text)) {
    const hasHigh = next.compliance_flags.some((f) => f.severity === "high");
    if (!hasHigh) {
      next.compliance_flags.unshift({
        flag: "Conflicting policy timing requirements detected",
        severity: "high",
        evidence: "Input text contains contradictory timing constraints.",
      });
    }
    next.confidence_score = Math.min(next.confidence_score, 0.55);
  }

  if (next.missing_information.length > 0 || hasMissingCriticalSignals(next)) {
    next.confidence_score = Math.min(next.confidence_score, 0.58);
  }

  if (next.confidence_score < 0.6 && !next.summary.toLowerCase().startsWith("caution:")) {
    next.summary = `Caution: ${next.summary}`;
  }

  return next;
}
