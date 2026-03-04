import type { InputPayload } from "./types";

export const scenarios: { id: string; label: string; input: InputPayload }[] = [
  {
    id: "high-risk-escalation",
    label: "Scenario 1",
    input: {
      policy_text:
        "If a high-risk referral indicates active self-harm risk, staff must contact on-call clinician within 15 minutes, attempt outreach to patient within 30 minutes, and document all actions in the care log before end of shift. If clinician is unavailable, escalate to backup supervisor immediately. No outreach may include diagnosis details over unsecured channels.",
      domain: "healthcare",
      urgency: "high",
      organization_context: "County care coordination team handling behavioral health referrals.",
      requester_role: "Operations Manager",
    },
  },
  {
    id: "routine-update",
    label: "Scenario 2",
    input: {
      policy_text:
        "For low-risk referrals, assign case owner within 1 business day, send first outreach message within 2 business days, and schedule follow-up check-in every 14 days until closure. Record each contact attempt in the CRM and close case after 3 unanswered attempts.",
      domain: "healthcare",
      urgency: "low",
      organization_context: "Outpatient care support operations team.",
      requester_role: "PM",
    },
  },
  {
    id: "missing-context",
    label: "Scenario 3",
    input: {
      policy_text:
        "Escalate referral concerns promptly and make sure updates are captured appropriately. Follow normal communication rules and involve the right people when risk appears elevated.",
      domain: "healthcare",
      urgency: "medium",
      organization_context: "Regional referral intake unit.",
      requester_role: "Analyst",
    },
  },
  {
    id: "conflicting-clauses",
    label: "Scenario 4",
    input: {
      policy_text:
        "For urgent referrals, outreach must occur within 30 minutes. Outreach should not begin until clinician review is completed within 24 hours. All urgent referrals require immediate documentation at intake.",
      domain: "healthcare",
      urgency: "high",
      organization_context: "Hospital discharge coordination desk.",
      requester_role: "Compliance Lead",
    },
  },
];
