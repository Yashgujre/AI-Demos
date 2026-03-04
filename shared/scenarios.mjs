export const scenarios = [
  {
    id: "high-risk-escalation",
    title: "Scenario 1: High-Risk Escalation",
    description: "Urgent patient deterioration triage policy with strict response times.",
    input: {
      policy_text:
        "If a high-risk referral indicates active self-harm risk, staff must contact on-call clinician within 15 minutes, attempt outreach to patient within 30 minutes, and document all actions in the care log before end of shift. If clinician is unavailable, escalate to backup supervisor immediately. No outreach may include diagnosis details over unsecured channels.",
      domain: "healthcare",
      urgency: "high",
      organization_context: "County care coordination team handling behavioral health referrals.",
      requester_role: "Operations Manager",
    },
    checks: {
      expectMissingInfo: false,
      expectHighSeverityFlag: false,
      expectLowConfidence: false,
    },
  },
  {
    id: "routine-update",
    title: "Scenario 2: Routine Process Update",
    description: "Standard follow-up policy for low-risk referrals.",
    input: {
      policy_text:
        "For low-risk referrals, assign case owner within 1 business day, send first outreach message within 2 business days, and schedule follow-up check-in every 14 days until closure. Record each contact attempt in the CRM and close case after 3 unanswered attempts.",
      domain: "healthcare",
      urgency: "low",
      organization_context: "Outpatient care support operations team.",
      requester_role: "PM",
    },
    checks: {
      expectMissingInfo: false,
      expectHighSeverityFlag: false,
      expectLowConfidence: false,
    },
  },
  {
    id: "missing-context",
    title: "Scenario 3: Missing Information",
    description: "Policy text missing ownership and timeline details.",
    input: {
      policy_text:
        "Escalate referral concerns promptly and make sure updates are captured appropriately. Follow normal communication rules and involve the right people when risk appears elevated.",
      domain: "healthcare",
      urgency: "medium",
      organization_context: "Regional referral intake unit.",
      requester_role: "Analyst",
    },
    checks: {
      expectMissingInfo: true,
      expectHighSeverityFlag: false,
      expectLowConfidence: true,
    },
  },
  {
    id: "conflicting-clauses",
    title: "Scenario 4: Conflicting Policy Clauses",
    description: "Policy includes contradictory response timing requirements.",
    input: {
      policy_text:
        "For urgent referrals, outreach must occur within 30 minutes. Outreach should not begin until clinician review is completed within 24 hours. All urgent referrals require immediate documentation at intake.",
      domain: "healthcare",
      urgency: "high",
      organization_context: "Hospital discharge coordination desk.",
      requester_role: "Compliance Lead",
    },
    checks: {
      expectMissingInfo: false,
      expectHighSeverityFlag: true,
      expectLowConfidence: true,
    },
  },
  {
    id: "immediate-vs-not-until",
    title: "Scenario 5: Immediate vs Not-Until Condition",
    description: "Immediate action is required, but policy also blocks action pending a delayed condition.",
    input: {
      policy_text:
        "For safety escalations, notify the patient immediately. Do not initiate outreach until supervisory review is completed within 12 hours. Log all updates before shift handoff.",
      domain: "healthcare",
      urgency: "high",
      organization_context: "Behavioral health escalation operations.",
      requester_role: "Operations Manager",
    },
    checks: {
      expectMissingInfo: false,
      expectHighSeverityFlag: true,
      expectLowConfidence: true,
    },
  },
  {
    id: "deadline-vs-before-delayed-event",
    title: "Scenario 6: Deadline vs Delayed Before Clause",
    description: "Short execution deadline conflicts with a delayed prerequisite event.",
    input: {
      policy_text:
        "Send initial patient outreach within 45 minutes. Complete outreach before specialist review is finalized within 2 days. Record communication attempts in the care tracker.",
      domain: "healthcare",
      urgency: "high",
      organization_context: "Care transition coordination team.",
      requester_role: "Compliance Lead",
    },
    checks: {
      expectMissingInfo: false,
      expectHighSeverityFlag: true,
      expectLowConfidence: true,
    },
  },
  {
    id: "deadline-vs-open-ended-wait",
    title: "Scenario 7: Deadline vs Open-Ended Wait Condition",
    description: "Policy requires fast response while blocking execution until an unspecified condition is met.",
    input: {
      policy_text:
        "Contact the patient within 1 hour of urgent referral intake. Do not begin outreach until payer authorization is confirmed. Document authorization outcome before closure.",
      domain: "healthcare",
      urgency: "high",
      organization_context: "Utilization management intake desk.",
      requester_role: "Analyst",
    },
    checks: {
      expectMissingInfo: false,
      expectHighSeverityFlag: true,
      expectLowConfidence: true,
    },
  },
];
