import { performance } from "node:perf_hooks";
import { scenarios } from "../shared/scenarios.mjs";
import { OutputSchema } from "../shared/schema.mjs";

process.env.MOCK_MODEL = process.env.MOCK_MODEL || "1";

const { processRequest } = await import("../backend/lib/service.mjs");

const results = [];

for (const scenario of scenarios) {
  const start = performance.now();
  let output;
  let error = null;
  try {
    output = await processRequest(scenario.input);
  } catch (err) {
    error = String(err?.message || err);
  }
  const elapsedMs = Math.round(performance.now() - start);

  const checks = {
    schema_valid: false,
    required_fields_present: false,
    missing_info_behavior: false,
    conflict_flag_behavior: false,
    confidence_behavior: false,
  };

  if (output) {
    const parsed = OutputSchema.safeParse(output);
    checks.schema_valid = parsed.success;
    checks.required_fields_present = Boolean(
      output.summary && output.actions?.length && output.audit_log?.policy_constraints_detected,
    );
    checks.missing_info_behavior = scenario.checks.expectMissingInfo
      ? output.missing_information.length > 0
      : true;
    checks.conflict_flag_behavior = scenario.checks.expectHighSeverityFlag
      ? output.compliance_flags.some((f) => f.severity === "high")
      : true;
    checks.confidence_behavior = scenario.checks.expectLowConfidence
      ? output.confidence_score < 0.6
      : output.confidence_score >= 0.6;
  }

  const pass = !error && Object.values(checks).every(Boolean);
  results.push({ id: scenario.id, pass, elapsedMs, checks, error });
}

const passed = results.filter((r) => r.pass).length;
const avgLatency = Math.round(results.reduce((s, r) => s + r.elapsedMs, 0) / results.length);

console.log("Policy-to-Action Copilot Eval Report");
console.log("==================================");
for (const r of results) {
  console.log(`- ${r.id}: ${r.pass ? "PASS" : "FAIL"} (${r.elapsedMs} ms)`);
  if (!r.pass) {
    console.log(`  error: ${r.error || "check failure"}`);
    console.log(`  checks: ${JSON.stringify(r.checks)}`);
  }
}
console.log("----------------------------------");
console.log(`Pass rate: ${passed}/${results.length}`);
console.log(`Average latency: ${avgLatency} ms`);
if (passed !== results.length) process.exitCode = 1;
