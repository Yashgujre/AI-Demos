import { z } from "zod";

export const InputSchema = z.object({
  policy_text: z.string().min(20).max(8000),
  domain: z.literal("healthcare"),
  urgency: z.enum(["low", "medium", "high"]),
  organization_context: z.string().min(3).max(1000),
  requester_role: z.enum(["PM", "Operations Manager", "Compliance Lead", "Analyst"]),
});

const ActionSchema = z.object({
  step: z.string().min(3),
  owner_role: z.string().min(2),
  due_window: z.string().min(2),
  reason: z.string().min(3),
});

const FlagSchema = z.object({
  flag: z.string().min(3),
  severity: z.enum(["low", "medium", "high"]),
  evidence: z.string().min(3),
});

export const OutputSchema = z.object({
  summary: z.string().min(5),
  priority_level: z.enum(["low", "medium", "high", "critical"]),
  actions: z.array(ActionSchema).min(1),
  compliance_flags: z.array(FlagSchema),
  missing_information: z.array(z.string()),
  stakeholder_update_draft: z.string().min(5),
  confidence_score: z.number().min(0).max(1),
  audit_log: z.object({
    policy_constraints_detected: z.array(z.string()),
    assumptions_made: z.array(z.string()),
  }),
});

export const ErrorSchema = z.object({
  error_code: z.enum(["RATE_LIMITED", "VALIDATION_FAILED", "MODEL_ERROR", "BAD_REQUEST"]),
  message: z.string(),
  details: z.string().nullable(),
});

export function normalizeOutput(raw) {
  return OutputSchema.parse(raw);
}
