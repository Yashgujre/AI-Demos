import assert from "node:assert/strict";
import {
  applyGuardrails,
  createsLogicalConflict,
  extractTimeConstraints,
  hasConflictSignals,
} from "../backend/lib/guardrails.mjs";
import { scenarios } from "../shared/scenarios.mjs";

function makeOutput(overrides = {}) {
  return {
    summary: "Generated summary",
    priority_level: "medium",
    actions: [
      {
        step: "Do first step",
        owner_role: "Operations Manager",
        due_window: "Within 1 hour",
        reason: "Policy requires action",
      },
    ],
    compliance_flags: [],
    missing_information: [],
    stakeholder_update_draft: "Draft",
    confidence_score: 0.9,
    audit_log: {
      policy_constraints_detected: [],
      assumptions_made: [],
    },
    ...overrides,
  };
}

function testExtractTimeConstraints() {
  const text =
    "Respond within 30 minutes. Notify immediately. Do not start until review completes within 4 hours. Document before handoff.";
  const constraints = extractTimeConstraints(text);
  const types = constraints.map((c) => c.type);

  assert.ok(types.includes("deadline"), "expected deadline constraint");
  assert.ok(types.includes("immediate"), "expected immediate constraint");
  assert.ok(types.includes("wait"), "expected wait constraint");
  assert.ok(types.includes("before"), "expected before constraint");
}

function testCreatesLogicalConflict() {
  assert.equal(
    createsLogicalConflict(
      { type: "immediate", durationMinutes: 0 },
      { type: "wait", durationMinutes: 120 },
    ),
    true,
    "immediate + wait should conflict",
  );

  assert.equal(
    createsLogicalConflict(
      { type: "deadline", durationMinutes: 30 },
      { type: "wait", durationMinutes: 240 },
    ),
    true,
    "short deadline + longer wait should conflict",
  );

  assert.equal(
    createsLogicalConflict(
      { type: "deadline", durationMinutes: 120 },
      { type: "before", durationMinutes: 60 },
    ),
    false,
    "deadline + earlier before-window should not conflict",
  );
}

function testHasConflictSignalsByScenario() {
  const byId = Object.fromEntries(scenarios.map((s) => [s.id, s]));

  for (const id of [
    "conflicting-clauses",
    "immediate-vs-not-until",
    "deadline-vs-before-delayed-event",
    "deadline-vs-open-ended-wait",
  ]) {
    assert.equal(
      hasConflictSignals(byId[id].input.policy_text),
      true,
      `expected conflict signals for ${id}`,
    );
  }

  for (const id of ["high-risk-escalation", "routine-update", "missing-context"]) {
    assert.equal(
      hasConflictSignals(byId[id].input.policy_text),
      false,
      `expected no conflict signals for ${id}`,
    );
  }
}

function testApplyGuardrailsConflictAndCaution() {
  const conflictInput = {
    policy_text:
      "Respond immediately. Do not begin outreach until supervisor review is complete within 12 hours.",
  };
  const output = makeOutput({ confidence_score: 0.85, compliance_flags: [] });
  const guarded = applyGuardrails(conflictInput, output);

  assert.ok(
    guarded.compliance_flags.some((f) => f.severity === "high"),
    "expected high-severity conflict flag",
  );
  assert.ok(guarded.confidence_score <= 0.55, "expected confidence cap <= 0.55");
  assert.ok(guarded.summary.startsWith("Caution:"), "expected caution prefix when confidence < 0.6");
}

testExtractTimeConstraints();
testCreatesLogicalConflict();
testHasConflictSignalsByScenario();
testApplyGuardrailsConflictAndCaution();

console.log("guardrails tests passed");
