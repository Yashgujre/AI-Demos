const MINUTES_PER_UNIT = {
  minute: 1,
  minutes: 1,
  hour: 60,
  hours: 60,
  day: 60 * 24,
  days: 60 * 24,
  "business day": 60 * 24,
  "business days": 60 * 24,
};

function extractDurationMinutes(text) {
  const match = text.match(
    /\bwithin\s+(\d+)\s*(minute|minutes|hour|hours|day|days|business day|business days)\b/i,
  );
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = MINUTES_PER_UNIT[unit];
  if (!multiplier || Number.isNaN(value)) return null;
  return value * multiplier;
}

function extractTimeConstraints(text) {
  const constraints = [];

  for (const match of text.matchAll(
    /\bwithin\s+(\d+)\s*(minute|minutes|hour|hours|day|days|business day|business days)\b/gi,
  )) {
    constraints.push({
      type: "deadline",
      raw: match[0],
      durationMinutes: extractDurationMinutes(match[0]),
    });
  }

  for (const match of text.matchAll(/\bimmediately\b/gi)) {
    constraints.push({
      type: "immediate",
      raw: match[0],
      durationMinutes: 0,
    });
  }

  for (const match of text.matchAll(/\b(?:not\s+until|do\s+not\b[^.;]*?\buntil)\s+([^.;]+)/gi)) {
    constraints.push({
      type: "wait",
      raw: match[0].trim(),
      durationMinutes: extractDurationMinutes(match[1]),
    });
  }

  for (const match of text.matchAll(/\bbefore\s+([^.;]+)/gi)) {
    constraints.push({
      type: "before",
      raw: match[0],
      durationMinutes: extractDurationMinutes(match[1]),
    });
  }

  return constraints;
}

function createsLogicalConflict(a, b) {
  const pair = [a.type, b.type].sort().join(":");

  if (pair === "immediate:wait") {
    return true;
  }

  if (pair === "deadline:wait" || pair === "before:deadline") {
    const deadline = a.type === "deadline" ? a : b.type === "deadline" ? b : null;
    const gate = a.type === "wait" || a.type === "before" ? a : b;

    if (!deadline) return false;

    if (gate.durationMinutes == null) {
      // A deadline with an unknown waiting condition is a conflict risk.
      // "before <event>" without a duration is generally just an ordering rule.
      return gate.type === "wait";
    }

    return gate.durationMinutes > (deadline.durationMinutes || 0);
  }

  return false;
}

function hasConflictSignals(text) {
  const constraints = extractTimeConstraints(text.toLowerCase());
  for (let i = 0; i < constraints.length; i += 1) {
    for (let j = i + 1; j < constraints.length; j += 1) {
      if (createsLogicalConflict(constraints[i], constraints[j])) {
        return true;
      }
    }
  }
  return false;
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
