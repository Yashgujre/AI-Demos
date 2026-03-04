export type InputPayload = {
  policy_text: string;
  domain: "healthcare";
  urgency: "low" | "medium" | "high";
  organization_context: string;
  requester_role: "PM" | "Operations Manager" | "Compliance Lead" | "Analyst";
};

export type OutputPayload = {
  summary: string;
  priority_level: "low" | "medium" | "high" | "critical";
  actions: Array<{
    step: string;
    owner_role: string;
    due_window: string;
    reason: string;
  }>;
  compliance_flags: Array<{
    flag: string;
    severity: "low" | "medium" | "high";
    evidence: string;
  }>;
  missing_information: string[];
  stakeholder_update_draft: string;
  confidence_score: number;
  audit_log: {
    policy_constraints_detected: string[];
    assumptions_made: string[];
  };
};

export type ApiError = {
  error_code: "RATE_LIMITED" | "VALIDATION_FAILED" | "MODEL_ERROR" | "BAD_REQUEST";
  message: string;
  details: string | null;
};
