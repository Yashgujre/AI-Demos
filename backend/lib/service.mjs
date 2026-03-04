import { ZodError } from "zod";
import { InputSchema, OutputSchema } from "../../shared/schema.mjs";
import { buildPrompt, buildCorrectionPrompt } from "./prompt.mjs";
import { generateWithGemini } from "./model.mjs";
import { applyGuardrails } from "./guardrails.mjs";

const OVERRIDE_LINE_PATTERNS = [
  /^\s*(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+instructions\b/i,
  /^\s*you\s+are\s+now\b/i,
  /^\s*(system|assistant|developer|user)\s*:/i,
  /^\s*(override|bypass)\b/i,
];

function parseJson(jsonText) {
  return JSON.parse(jsonText);
}

function stripMarkdownFences(text) {
  return text.replace(/```[\s\S]*?```/g, " ");
}

function stripLikelyJsonBlocks(text) {
  return text
    .replace(/^\s*[{[][\s\S]*?[}\]]\s*$/gm, " ")
    .replace(/(?:^|\n)\s*\{[\s\S]*?\}\s*(?=\n|$)/g, "\n");
}

function stripOverrideLines(text) {
  const lines = text.split("\n");
  return lines
    .filter((line) => !OVERRIDE_LINE_PATTERNS.some((pattern) => pattern.test(line)))
    .join("\n");
}

export function sanitizeInput(validInput) {
  let policyText = validInput.policy_text;
  policyText = stripMarkdownFences(policyText);
  policyText = stripLikelyJsonBlocks(policyText);
  policyText = stripOverrideLines(policyText);
  policyText = policyText.replace(/\n{3,}/g, "\n\n").trim();

  return {
    ...validInput,
    policy_text: policyText,
  };
}

function zodIssues(error) {
  if (error instanceof ZodError) {
    return error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; ");
  }
  return String(error?.message || error);
}

export async function processRequest(input) {
  const validInput = InputSchema.parse(input);
  const sanitizedInput = sanitizeInput(validInput);

  const firstPrompt = buildPrompt(sanitizedInput);
  let raw = await generateWithGemini(firstPrompt);

  try {
    const parsed = parseJson(raw);
    const validated = OutputSchema.parse(parsed);
    return applyGuardrails(sanitizedInput, validated);
  } catch (err) {
    const correctionPrompt = buildCorrectionPrompt(sanitizedInput, raw, zodIssues(err));
    raw = await generateWithGemini(correctionPrompt);
    const parsedRetry = parseJson(raw);
    const validatedRetry = OutputSchema.parse(parsedRetry);
    return applyGuardrails(sanitizedInput, validatedRetry);
  }
}
