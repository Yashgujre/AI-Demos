import { ZodError } from "zod";
import { InputSchema, OutputSchema } from "../../shared/schema.mjs";
import { buildPrompt, buildCorrectionPrompt } from "./prompt.mjs";
import { generateWithGemini, MODEL_TIMEOUT_MESSAGE } from "./model.mjs";
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

function isTimeoutError(error) {
  return String(error?.message || "").includes(MODEL_TIMEOUT_MESSAGE);
}

function zodIssues(error) {
  if (error instanceof ZodError) {
    return error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; ");
  }
  return String(error?.message || error);
}

export async function processRequest(input, options = {}) {
  const validInput = InputSchema.parse(input);
  const sanitizedInput = sanitizeInput(validInput);
  const includeRaw = options.includeRaw === true;
  const rawOutputs = [];

  const firstPrompt = buildPrompt(sanitizedInput);
  let raw;
  try {
    raw = await generateWithGemini(firstPrompt);
    if (includeRaw) rawOutputs.push(raw);
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Error(MODEL_TIMEOUT_MESSAGE);
    }
    throw error;
  }

  try {
    const parsed = parseJson(raw);
    const validated = OutputSchema.parse(parsed);
    const output = applyGuardrails(sanitizedInput, validated);
    return includeRaw ? { output, model_output_raw: rawOutputs } : output;
  } catch (err) {
    const correctionPrompt = buildCorrectionPrompt(sanitizedInput, raw, zodIssues(err));
    try {
      raw = await generateWithGemini(correctionPrompt);
      if (includeRaw) rawOutputs.push(raw);
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new Error(MODEL_TIMEOUT_MESSAGE);
      }
      throw error;
    }
    const parsedRetry = parseJson(raw);
    const validatedRetry = OutputSchema.parse(parsedRetry);
    const outputRetry = applyGuardrails(sanitizedInput, validatedRetry);
    return includeRaw ? { output: outputRetry, model_output_raw: rawOutputs } : outputRetry;
  }
}
